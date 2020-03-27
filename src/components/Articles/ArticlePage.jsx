import React from 'react';
import { Spin } from 'antd';
import Context from '../Context';
import Article from './Article';
import { StyledCenteredContainer } from './styled';
import ArticleComment from './ArticleComment';
import CommentForm from '../forms/CommentForm';
import queries from '../../serverQueries';
import { createTreeBuildFunction } from '../../utils';

const buildCommentTreeFromFlat = createTreeBuildFunction('id', 'parentId');

class ArticlePage extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      loading: true,
      error: null,
      article: null,
      commentsTree: [],
      flatComments: [],
      commentWithOpenEditor: null,
      eventType: 'reply',
    };
  }

  componentDidMount() {
    this.fetchArticle();
  }

  fetchArticle = async () => {
    // eslint-disable-next-line react/destructuring-assignment,react/prop-types
    const { articleId } = this.props.match.params;
    try {
      this.setState({
        loading: true,
      });
      const { article, articleCommentDto = [] } = await queries.getArticleById({ id: articleId });
      this.setState({
        loading: false,
        error: null,
        article,
        commentsTree: buildCommentTreeFromFlat(articleCommentDto),
        flatComments: articleCommentDto,
      });
    } catch (err) {
      this.setState({
        loading: false,
        error: err,
      });
    }
  };

  handleCommentFormSubmit = commentId => async ({ text }) => {
    const { eventType } = this.state;
    try {
      const fn = eventType === 'edit' ? this.editComment : this.postComment;
      await fn(commentId, text);
      //  TODO
      // eslint-disable-next-line no-empty
    } catch (error) {}
  };

  postComment = async (answerId, text) => {
    const {
      article: { id },
    } = this.state;

    const {
      user: { id: idUser },
    } = this.context;

    const params = { idArticle: id, idUser };
    // на бэкенде валится запрос если поле null
    if (answerId) {
      params.answerId = answerId;
    }
    const comment = await queries.createArticleComment(text, params);
    this.setState(
      ({ flatComments }) => ({
        flatComments: [...flatComments, comment],
      }),
      () => {
        this.handleOpenEditorClick(null)(); // убираем окно редактирования коментария
        this.rebuildTree(); // перестраиваем дерево коментов
      }
    );
  };

  editComment = async (commentId, text) => {
    const {
      article: { id: idArticle },
    } = this.state;

    const {
      user: { id: idUser },
    } = this.context;

    const updatedComment = await queries.updateArticleComment(text, {
      idArticle,
      idUser,
      commentID: commentId,
    });
    this.setState(
      ({ flatComments }) => {
        const comments = flatComments.reduce(
          (acc, comment) =>
            comment.id === commentId ? [...acc, updatedComment] : [...acc, comment],
          []
        );
        return {
          flatComments: comments,
        };
      },
      () => {
        this.handleOpenEditorClick(null)(); // убираем окно редактирования коментария
        this.rebuildTree(); // перестраиваем дерево коментов
      }
    );
  };

  // TODO был другой способ, но там вылез баг, не было времени сделать нормально
  rebuildTree = () => {
    this.setState(({ flatComments }) => ({
      commentsTree: buildCommentTreeFromFlat(flatComments),
    }));
  };

  handleOpenEditorClick = (id, eventType) => () => {
    this.setState({ commentWithOpenEditor: id, eventType });
  };

  handleDeleteComment = (commentId, parentId) => async () => {
    await queries.deleteArticleComment(commentId);

    /* после отправки запроса на удаление комента в ответе не приходят обновленные коменты 
    поэтому для обновления ui проходимся по массиву коментов
    смотрим если на комент ссылаются другие мы меняем ему статус на deleted:true, и содержание на Комментарий был удален 
    дублирую работу на сервере без отправления запроса
    */
    // вспомошательная функция проверки наличия  подкоментов
    const hasChildrenComments = (comments, id) => {
      for (let i = 0; i < comments.length; i++) {
        if (comments[i].parentId === id) {
          return true;
        }
      }
      return false;
    };

    const createNewCommentsList = ar => {
      return ar.reduce((acc, comment) => {
        if (comment.id !== commentId) {
          return [...acc, comment];
        }
        if (comment.id === commentId && hasChildrenComments(ar, commentId)) {
          return [...acc, { ...comment, deleted: true, commentText: 'Комментарий был удален' }];
        }
        return acc;
      }, []);
    };

    const clearComments = comments => {
      if (parentId === -1) {
        return comments;
      }
      /*
      функция для проверки вложенных коментов если: 
      комент удален 
        комент удален 
          КОМЕНТ -------------> нажимаем удалить то вся ветка больше не показывается 
      */
      const iter = (ar, id) => {
        const index = ar.findIndex(el => el.id === id);
        // если у комента нет подкоментов и этот комент со статусом deleted
        if (!hasChildrenComments(ar, id) && ar[index].deleted) {
          // если у комента не родителей то возвращаем обновленный лист коментов
          if (ar[index].parentId === -1) {
            return [...ar.slice(0, index), ...ar.slice(index + 1)];
          }
          return iter([...ar.slice(0, index), ...ar.slice(index + 1)], ar[index].parentId); // если родители есть рекурсивно проверяем на пустые коменты
        }
        return ar;
      };
      return iter(comments, parentId);
    };

    this.setState(
      ({ flatComments }) => ({ flatComments: clearComments(createNewCommentsList(flatComments)) }),
      () => {
        this.handleOpenEditorClick(null)(); // убираем окно редактирования коментария
        this.rebuildTree(); // перестраиваем дерево коментов
      }
    );
  };

  renderCommentForm() {
    const { isLogin } = this.context;
    return isLogin ? (
      <CommentForm onSubmit={this.handleCommentFormSubmit()} />
    ) : (
      <div>Только авторизированные пользователи могут оставлять комментарии</div>
    );
  }

  render() {
    const {
      error,
      loading,
      article,
      commentsTree,
      flatComments,
      commentWithOpenEditor,
    } = this.state;

    if (error || loading) {
      return (
        <StyledCenteredContainer>
          {loading ? <Spin /> : 'Не удалось загрузить статью'}
        </StyledCenteredContainer>
      );
    }

    const commentsCount = flatComments ? flatComments.length : 0;
    const { eventType } = this.state;
    return (
      <>
        <Article articleInfo={article} />
        <div>Комментарии ({commentsCount})</div>
        {commentsTree.map(comment => (
          <ArticleComment
            commentWithOpenEditor={commentWithOpenEditor}
            key={comment.key}
            comment={comment}
            onOpenEditorClick={this.handleOpenEditorClick}
            onSubmitCommentForm={this.handleCommentFormSubmit}
            onDeleteComment={this.handleDeleteComment}
            eventType={eventType}
          />
        ))}
        {this.renderCommentForm()}
      </>
    );
  }
}
ArticlePage.contextType = Context;

ArticlePage.propTypes = {};

ArticlePage.defaultProps = {};

export default ArticlePage;
