import React from 'react';
import styled from 'styled-components';
import propTypes from 'prop-types';
import { Upload, Button, Icon, Row } from 'antd';
import queries from '../../serverQueries';

const url = 'http://localhost:8888/api/';
const photoTempUrl = `${url}securedPhoto/photoFromAlbum/`;

const Wrapper = styled.div`
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  background: white;
  opacity: 0.9;
  padding: 130px 100px;
  display: ${props => (props.hidden ? 'hidden' : 'block')};
`;

const Form = styled.form`
  padding: 10px;
  margin: 0 auto;
  width: 500px;
  border: 1px solid black;
  background: white;
  opacity: 1;
`;

const Gallery = styled.div`
  display: flex;
  flex-wrap: wrap;
  margin: 10px auto;
  align-items: flex-start;
`;

const CloseModalButton = styled(Button)`
  position: absolute;
  top: 20px;
  right: 20px;
`;

const BGImage = styled.img`
  object-fit: cover;
  object-position: top center;
  width: 148px;
  height: 100px;
`;

const AlbumCard = styled.div`
  position: relative;
  width: 152px;
  border: ${props => (props.selected ? '2px solid #1890ff' : '2px solid black')};
  background-size: cover;
  margin: 2px;
`;

const AlbumShadow = styled.div`
    color: #fff;
    box-sizing: border-box;
    position: absolute; 
    bottom: 0;
    width: 100%;
    padding: 35px 12px 9px;
    background: url(/shadow.png);
}`;

const AlbumTitle = styled.span`
  word-break: break-all;
  position: absolute;
  bottom: 0;
  padding: 10px;
  left: 0;
  color: #fff;
`;

const PhotoCounter = styled.span`
  position: absolute;
  bottom: 0;
  right: 0;
  padding: 10px;
  color: #fff;
`;

const ImageCard = styled.div`
  display: inline-block;
  position: relative;
  width: 152px;
  border: 2px solid black;
  background-size: cover;
  margin: 2px;
`;

const ChoosePhotoButton = styled(Button)`
  position: absolute;
  top: 5px;
  left: 5px;
`;

class TopicAddFileModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      albums: [],
      fileList: [],
    };
  }

  componentDidMount() {
    this.loadAlbums();
  }

  loadAlbums = async () => {
    const allAlbums = await queries.getAlbums();
    const promises = allAlbums.map(album => {
      return queries.getPhotosFromAlbum(album.id).then(data => {
        const images = data.map(image => ({
          src: `${photoTempUrl}${image.id}?type=original`,
          id: image.id,
        }));
        return { ...album, selected: false, images };
      });
    });
    Promise.all(promises).then(albums => {
      this.setState({ albums });
    });
  };

  toggleFullAlbum = id => async () => {
    const { albums } = this.state;
    const newAlbums = albums.map(item => {
      if (item.id === id) {
        return { ...item, selected: !item.selected };
      }
      return { ...item, selected: false };
    });
    this.setState({ albums: newAlbums });
  };

  handleUpload = async () => {
    const { fileList } = this.state;
    const { setFileList } = this.props;
    const formData = new FormData();

    fileList.forEach(file => {
      formData.append('photos', file);
    });
    // Необходимо добавить функционал загрузки изображений
    // в топик по id на бэкенде
    // http://localhost:8888/api/securedPhoto/photoFromAlbum/id'

    setFileList(formData);
  };

  render() {
    const { fileList, albums } = this.state;
    const { handleCloseModal, toggleImageToUpload, imagesToUpload } = this.props;

    const selectedAlbum = albums.find(album => album.selected);
    const uploadProps = {
      accept: '.jpg, .jpeg, .png',
      multiple: true,
      onRemove: file => {
        const index = fileList.indexOf(file);
        const newFileList = fileList.slice();
        newFileList.splice(index, 1);
        this.setState({
          fileList: newFileList,
        });
      },
      beforeUpload: file => {
        this.setState(state => ({
          fileList: [...state.fileList, file],
        }));
        return false;
      },
      fileList,
    };
    return (
      <Wrapper>
        <Form>
          <CloseModalButton onClick={handleCloseModal(false)}>
            <Icon type="close" />
          </CloseModalButton>
          <Row type="flex" justify="center">
            <Upload {...uploadProps}>
              <Button>
                <Icon type="upload" />
                <span>Перетащите сюда или выберите фотографии</span>
              </Button>
            </Upload>
          </Row>
          <Gallery>
            {albums.map(album => (
              <AlbumCard
                key={album.id}
                onClick={this.toggleFullAlbum(album.id)}
                selected={selectedAlbum && album.id === selectedAlbum.id}
              >
                <BGImage
                  src={
                    album.originalThumbImage === 'thumb_image_placeholder'
                      ? '/defaultAlbumPicture.jpg'
                      : `${url}img/chat/${album.originalThumbImage}`
                  }
                />
                <AlbumShadow>
                  <AlbumTitle>{album.title}</AlbumTitle>
                  <PhotoCounter>{album.photosCounter}</PhotoCounter>
                </AlbumShadow>
              </AlbumCard>
            ))}
          </Gallery>
          {selectedAlbum ? (
            <>
              <Row type="flex" justify="center">
                {selectedAlbum.images.length > 0 ? (
                  <h4>Фотографии альбома:</h4>
                ) : (
                  <h4>Альбом пуст</h4>
                )}
              </Row>
              <Gallery>
                {selectedAlbum.images.map(image => (
                  <ImageCard key={image.src}>
                    <BGImage src={image.src} alt="user-image" />
                    <ChoosePhotoButton
                      shape="circle"
                      icon={imagesToUpload.includes(image.id) ? 'check' : undefined}
                      onClick={toggleImageToUpload(image.id)}
                    />
                  </ImageCard>
                ))}
              </Gallery>
            </>
          ) : null}
          <Row type="flex" justify="center">
            <Button
              type="primary"
              onClick={this.handleUpload}
              disabled={fileList.length === 0 && imagesToUpload.length === 0}
              style={{ marginBottom: 10 }}
            >
              Выбрать фотографии
            </Button>
          </Row>
        </Form>
      </Wrapper>
    );
  }
}

TopicAddFileModal.propTypes = {
  setFileList: propTypes.func.isRequired,
  handleCloseModal: propTypes.func.isRequired,
  toggleImageToUpload: propTypes.func.isRequired,
  imagesToUpload: propTypes.arrayOf(propTypes.number).isRequired,
};

export default TopicAddFileModal;
