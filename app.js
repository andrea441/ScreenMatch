document.addEventListener("DOMContentLoaded", () => {
    // Menú desplegable de búsqueda
    const buscarMenu = document.getElementById('buscarMenu');
    const buscarDropdown = document.getElementById('buscarDropdown');
    
    buscarMenu.addEventListener('click', () => {
      buscarDropdown.classList.toggle('show');
    });
  
    // Selector de idioma
    const languageSelector = document.getElementById('languageSelector');
    languageSelector.addEventListener('click', () => {
      const currentLanguage = languageSelector.textContent;
      languageSelector.textContent = currentLanguage === 'ES' ? 'EN' : 'ES';
      alert('Idioma cambiado a ' + languageSelector.textContent);
    });
  
    // API Key de TMDb
    const apiKey = 'TU_API_KEY'; // Coloca API key de TMDb
    const baseUrl = 'https://api.themoviedb.org/3/movie/upcoming';
    const imageUrl = 'https://image.tmdb.org/t/p/w500';
  
    // Contenedor de películas próximas
    const upcomingMoviesContainer = document.getElementById('upcomingMovies');
  
    // Fetch a la API de TMDb
    fetch(`${baseUrl}?api_key=${apiKey}&language=es-ES&page=1`)
      .then(response => response.json())
      .then(data => {
        data.results.forEach(movie => {
          const movieCard = createMovieCard(movie);
          upcomingMoviesContainer.appendChild(movieCard);
        });
      })
      .catch(error => {
        console.error('Error al obtener los datos:', error);
      });
  
    // Función para crear una tarjeta de película
    function createMovieCard(movie) {
      const card = document.createElement('div');
      card.className = 'card';
  
      const title = document.createElement('h3');
      title.textContent = movie.title;
      card.appendChild(title);
  
      const video = document.createElement('div');
      video.className = 'video-thumbnail';
      const playButton = document.createElement('button');
      playButton.textContent = 'Play';
      playButton.addEventListener('click', () => {
        alert('Aquí podrías reproducir el tráiler usando la API de YouTube');
      });
      video.appendChild(playButton);
      card.appendChild(video);
  
      const image = document.createElement('img');
      image.src = `${imageUrl}${movie.poster_path}`;
      image.alt = movie.title;
      card.appendChild(image);
  
      const description = document.createElement('p');
      description.textContent = movie.overview;
      card.appendChild(description);
  
      return card;
    }
  });
  