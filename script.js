// Configuración de TMDB API
const TMDB_API_KEY = 'ee4278db3e89463fb9568b1538a8c9c7';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMG_BASE = 'https://image.tmdb.org/t/p/w500';

// Datos globales
let userRatings = [];
let recommendations = [];
let allRecommendations = [];
let movieCache = new Map();
let genreMap = new Map();

// Elementos del DOM
const csvFileInput = document.getElementById('csvFile');
const mainContent = document.getElementById('mainContent');
const loadingMessage = document.getElementById('loadingMessage');
const errorMessage = document.getElementById('errorMessage');
const recommendationsContainer = document.getElementById('recommendationsContainer');
const regenerateBtn = document.getElementById('regenerateBtn');
const exportBtn = document.getElementById('exportBtn');
const genreFilter = document.getElementById('genreFilter');
const yearFilter = document.getElementById('yearFilter');
const clearFiltersBtn = document.getElementById('clearFilters');

// Event Listeners
csvFileInput.addEventListener('change', handleFileUpload);
regenerateBtn?.addEventListener('click', generateRecommendations);
exportBtn?.addEventListener('click', exportRecommendations);
genreFilter?.addEventListener('change', filterRecommendations);
yearFilter?.addEventListener('change', filterRecommendations);
clearFiltersBtn?.addEventListener('click', clearFilters);

// Inicializar mapa de géneros
async function initializeGenreMap() {
    try {
        const response = await fetch(
            `${TMDB_BASE_URL}/genre/movie/list?api_key=${TMDB_API_KEY}&language=es-ES`
        );
        const data = await response.json();
        data.genres.forEach(genre => {
            genreMap.set(genre.id, genre.name);
        });
    } catch (error) {
        console.error('Error initializing genre map:', error);
    }
}

// Función para obtener nombre de género por ID
function getGenreName(genreId) {
    return genreMap.get(genreId) || 'Unknown';
}

// Función para buscar una película en TMDB
async function searchMovieInTMDB(title, year) {
    const query = encodeURIComponent(title);
    const url = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${query}&year=${year}&language=es-ES`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        return data.results.find(movie => 
            Math.abs(new Date(movie.release_date).getFullYear() - year) <= 1
        );
    } catch (error) {
        console.error('Error searching movie:', error);
        return null;
    }
}

// Función para obtener recomendaciones de TMDB
async function getMovieRecommendations(movieId) {
    const url = `${TMDB_BASE_URL}/movie/${movieId}/recommendations?api_key=${TMDB_API_KEY}&language=es-ES`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        return data.results;
    } catch (error) {
        console.error('Error getting recommendations:', error);
        return [];
    }
}

// Función para validar el formato del CSV de IMDb
function validateIMDbFormat(headers) {
    const requiredHeaders = [
        'Const',
        'Your Rating',
        'Title',
        'Year',
        'Genres',
        'Title Type'
    ];
    
    return requiredHeaders.every(header => headers.includes(header));
}

// Función para manejar la carga del archivo CSV
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    loadingMessage.classList.remove('d-none');
    errorMessage.classList.add('d-none');
    mainContent.classList.add('d-none');

    try {
        await initializeGenreMap(); // Inicializar mapa de géneros

        const results = await new Promise((resolve) => {
            Papa.parse(file, {
                header: true,
                complete: resolve,
                error: (error) => {
                    throw new Error(error);
                }
            });
        });

        if (!validateIMDbFormat(results.meta.fields)) {
            throw new Error('Formato de archivo inválido');
        }

        // Filtrar películas y procesar ratings
        userRatings = results.data
            .filter(row => 
                row['Title Type']?.toLowerCase() === 'movie' &&
                row['Your Rating'] && 
                row['Title']
            )
            .map(row => ({
                imdbId: row['Const'],
                rating: parseFloat(row['Your Rating']),
                title: row['Title'],
                year: parseInt(row['Year']),
                genres: row['Genres'] ? row['Genres'].split(', ') : []
            }));

        if (userRatings.length === 0) {
            throw new Error('No se encontraron películas válidas');
        }

        const highRatedMovies = userRatings
            .filter(movie => movie.rating >= 7)
            .slice(0, 10);

        for (const movie of highRatedMovies) {
            const tmdbMovie = await searchMovieInTMDB(movie.title, movie.year);
            if (tmdbMovie) {
                movie.tmdbId = tmdbMovie.id;
                movieCache.set(tmdbMovie.id, tmdbMovie);
            }
        }

        showImportStats();
        mainContent.classList.remove('d-none');
        await generateRecommendations();

    } catch (error) {
        console.error(error);
        errorMessage.textContent = error.message || 'Error al procesar el archivo';
        errorMessage.classList.remove('d-none');
        csvFileInput.value = '';
    } finally {
        loadingMessage.classList.add('d-none');
    }
}

// Función para mostrar estadísticas de la importación
function showImportStats() {
    // Elimina cualquier mensaje existente
    const existingMessage = document.querySelector('.alert.alert-success');
    if (existingMessage) {
        existingMessage.remove();
    }

    // Crear el nuevo mensaje
    const statsMessage = document.createElement('div');
    statsMessage.className = 'alert alert-success';
    const avgRating = (userRatings.reduce((sum, movie) => sum + movie.rating, 0) / userRatings.length).toFixed(1);
    
    statsMessage.innerHTML = `
        <h6>Importación exitosa:</h6>
        <ul class="mb-0">
            <li>${userRatings.length} películas importadas</li>
            <li>Calificación promedio: ${avgRating}/10</li>
            <li>Años: ${Math.min(...userRatings.map(m => m.year))} - ${Math.max(...userRatings.map(m => m.year))}</li>
        </ul>
    `;
    
    errorMessage.insertAdjacentElement('afterend', statsMessage);
}

// Función para inicializar los filtros
// Función para inicializar los filtros
function initializeFilters() {
    // Obtener géneros únicos de las recomendaciones
    const genres = new Set();
    recommendations.forEach(movie => {
        movie.genres.forEach(genre => genres.add(genre));
    });
    
    // Poblar selector de géneros
    genreFilter.innerHTML = '<option value="">Todos los géneros</option>';
    [...genres].sort().forEach(genre => {
        const option = document.createElement('option');
        option.value = genre;
        option.textContent = genre;
        genreFilter.appendChild(option);
    });
    
    // Obtener años únicos de las recomendaciones
    const years = new Set(recommendations.map(movie => movie.year));
    
    // Poblar selector de años
    yearFilter.innerHTML = '<option value="">Todos los años</option>';
    [...years].sort().reverse().forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearFilter.appendChild(option);
    });
}

// Función para analizar preferencias del usuario
function analyzeUserPreferences(ratings) {
    // Calcular estadísticas básicas
    const avgRating = ratings.reduce((sum, m) => sum + m.rating, 0) / ratings.length;
    
    // Analizar preferencias por género
    const genreStats = {};
    ratings.forEach(movie => {
        movie.genres.forEach(genre => {
            if (!genreStats[genre]) {
                genreStats[genre] = {
                    count: 0,
                    totalRating: 0,
                    highRatedCount: 0
                };
            }
            genreStats[genre].count++;
            genreStats[genre].totalRating += movie.rating;
            if (movie.rating >= 8) {
                genreStats[genre].highRatedCount++;
            }
        });
    });

    // Calcular pesos de géneros
    const genreWeights = {};
    Object.entries(genreStats).forEach(([genre, stats]) => {
        const avgGenreRating = stats.totalRating / stats.count;
        const frequencyWeight = stats.count / ratings.length;
        const highRatedRatio = stats.highRatedCount / stats.count;
        
        // Combinar factores para el peso final
        genreWeights[genre] = (avgGenreRating * 0.4 + frequencyWeight * 0.3 + highRatedRatio * 0.3) * 10;
    });

    return {
        avgRating,
        genreWeights,
        // Usar películas con rating 7+ como semillas
        ratingThreshold: 7.0
    };
}

// Función actualizada para seleccionar películas semilla
function selectSeedMovies(ratings, preferences) {
    // Filtrar películas bien calificadas con ID de TMDB
    const goodMovies = ratings.filter(movie => 
        movie.tmdbId && 
        movie.rating >= preferences.ratingThreshold
    );
    
    // Ordenar por rating y agrupar por género principal
    const moviesByGenre = {};
    goodMovies.forEach(movie => {
        if (movie.genres.length > 0) {
            const mainGenre = movie.genres[0];
            moviesByGenre[mainGenre] = moviesByGenre[mainGenre] || [];
            moviesByGenre[mainGenre].push(movie);
        }
    });

    // Seleccionar las mejores películas de cada género preferido
    const seedMovies = new Set();
    const targetSeeds = 10; // Aumentamos a 10 para más variedad

    // Ordenar géneros por peso
    const sortedGenres = Object.entries(preferences.genreWeights)
        .sort((a, b) => b[1] - a[1])
        .map(([genre]) => genre);

    // Seleccionar las mejores películas de cada género principal
    sortedGenres.forEach(genre => {
        if (seedMovies.size >= targetSeeds) return;
        
        const genreMovies = moviesByGenre[genre];
        if (genreMovies && genreMovies.length > 0) {
            // Tomar las 2 mejores películas del género si están disponibles
            genreMovies
                .sort((a, b) => b.rating - a.rating)
                .slice(0, 2)
                .forEach(movie => seedMovies.add(movie));
        }
    });

    // Si aún no tenemos suficientes, agregar las películas mejor calificadas restantes
    if (seedMovies.size < targetSeeds) {
        goodMovies
            .sort((a, b) => b.rating - a.rating)
            .forEach(movie => {
                if (seedMovies.size < targetSeeds && !seedMovies.has(movie)) {
                    seedMovies.add(movie);
                }
            });
    }

    return Array.from(seedMovies);
}

// Función actualizada para obtener y procesar recomendaciones
async function getRecommendationPool(seedMovies, userPreferences) {
    const recommendationPool = new Map();
    
    for (const seedMovie of seedMovies) {
        try {
            const recommendations = await getMovieRecommendations(seedMovie.tmdbId);
            
            recommendations.forEach(rec => {
                if (!recommendationPool.has(rec.id)) {
                    recommendationPool.set(rec.id, {
                        tmdbData: rec,
                        seedMovies: [seedMovie],
                        genreScore: calculateGenreScore(rec.genre_ids, userPreferences.genreWeights)
                    });
                } else {
                    const existing = recommendationPool.get(rec.id);
                    existing.seedMovies.push(seedMovie);
                }
            });
        } catch (error) {
            console.error(`Error getting recommendations for ${seedMovie.title}:`, error);
        }
    }
    
    return recommendationPool;
}

// Nueva función para calcular score de géneros
function calculateGenreScore(genreIds, genreWeights) {
    return genreIds.reduce((score, genreId) => {
        const genreName = getGenreName(genreId);
        return score + (genreWeights[genreName] || 0);
    }, 0);
}

// Función principal de generación de recomendaciones actualizada
async function generateRecommendations() {
    loadingMessage.classList.remove('d-none');
    recommendationsContainer.innerHTML = '';
    
    try {
        const userPreferences = analyzeUserPreferences(userRatings);
        const seedMovies = selectSeedMovies(userRatings, userPreferences);
        const recommendationPool = await getRecommendationPool(seedMovies, userPreferences);
        
        const processedRecommendations = [];
        
        for (const [_, recommendation] of recommendationPool) {
            const rec = recommendation.tmdbData;
            
            // Evitar películas ya vistas
            if (userRatings.some(ur => ur.tmdbId === rec.id)) continue;
            
            // Calcular score final
            const baseScore = rec.vote_average * 0.6; // Peso del rating TMDB
            const genreScore = recommendation.genreScore * 0.2; // Peso de coincidencia de géneros
            const seedScore = Math.log2(recommendation.seedMovies.length + 1) * 2; // Peso por coincidencias múltiples
            const popularityScore = Math.log10(rec.popularity + 1) * 0.2; // Peso de popularidad
            
            const finalScore = baseScore + genreScore + seedScore + popularityScore;
            
            processedRecommendations.push({
                tmdbId: rec.id,
                title: rec.title,
                year: new Date(rec.release_date).getFullYear(),
                overview: rec.overview,
                posterPath: rec.poster_path,
                voteAverage: rec.vote_average,
                score: finalScore,
                matchCount: recommendation.seedMovies.length,
                genres: rec.genre_ids.map(id => getGenreName(id))
            });
        }
        
        // Guardar en ambos arrays
        allRecommendations = processedRecommendations
            .sort((a, b) => b.score - a.score)
            .slice(0, 8);
        recommendations = [...allRecommendations];
        
        // Inicializar los filtros
        initializeFilters();
        displayRecommendations();
        
    } catch (error) {
        console.error('Error generating recommendations:', error);
        errorMessage.textContent = 'Error al generar recomendaciones';
        errorMessage.classList.remove('d-none');
    } finally {
        loadingMessage.classList.add('d-none');
    }
}


// Función para mostrar las recomendaciones
function displayRecommendations() {
    recommendationsContainer.innerHTML = '';
    
    recommendations.forEach(movie => {
        const card = document.createElement('div');
        card.className = 'col-md-3 mb-4';
        
        // Formatear la fecha de lanzamiento
        const releaseDate = new Date(movie.release_date || `${movie.year}-01-01`);
        const formattedDate = releaseDate.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Formatear géneros
        const genres = movie.genres.join(', ');

        card.innerHTML = `
            <div class="card movie-card">
                ${movie.posterPath 
                    ? `<img src="${TMDB_IMG_BASE}${movie.posterPath}" class="card-img-top" alt="${movie.title}">`
                    : `<div class="card-img-top d-flex align-items-center justify-content-center bg-secondary">
                         <span class="text-white">No poster available</span>
                       </div>`
                }
                <span class="rating-badge">
                    <i class="fas fa-star text-warning"></i> 
                    ${movie.voteAverage.toFixed(1)}
                </span>
                
                <div class="card-overlay">
                    <div class="overlay-content">
                        <h3 class="overlay-title">${movie.title}</h3>
                        
                        <div class="overlay-info">
                            <p><strong>Año:</strong> ${movie.year}</p>
                            <p><strong>Género${movie.genres.length > 1 ? 's' : ''}:</strong> ${genres}</p>
                            <p><strong>Puntuación TMDB:</strong> ${movie.voteAverage.toFixed(1)}/10</p>
                        </div>
                        
                        <div class="overlay-overview">
                            <strong>Sinopsis:</strong><br>
                            ${movie.overview || 'No hay sinopsis disponible.'}
                        </div>
                        
                        <div class="overlay-stats">
                            <p>Score del algoritmo: ${movie.score.toFixed(2)}</p>
                            <p>Coincidencias: ${movie.matchCount} película${movie.matchCount !== 1 ? 's' : ''}</p>
                        </div>
                    </div>
                    
                    <div class="tmdb-link-container">
                        <a href="https://www.themoviedb.org/movie/${movie.tmdbId}" 
                           class="tmdb-link" 
                           target="_blank" 
                           rel="noopener noreferrer">
                            Ver en TMDB
                        </a>
                    </div>
                </div>
            </div>
        `;
        
        recommendationsContainer.appendChild(card);
    });
}

// Función para filtrar recomendaciones
function filterRecommendations() {
    const selectedGenre = genreFilter.value;
    const selectedYear = yearFilter.value;
    
    // Siempre empezar desde todas las recomendaciones
    recommendations = [...allRecommendations];
    
    // Aplicar ambos filtros si están seleccionados
    recommendations = recommendations.filter(movie => {
        const matchesGenre = !selectedGenre || movie.genres.includes(selectedGenre);
        const matchesYear = !selectedYear || movie.year.toString() === selectedYear;
        return matchesGenre && matchesYear;
    });
    
    displayRecommendations();
}

// Función para limpiar los filtros
function clearFilters() {
    // Resetear los valores de los selectores
    genreFilter.value = '';
    yearFilter.value = '';
    
    // Restaurar todas las recomendaciones
    recommendations = [...allRecommendations];
    
    // Mostrar todas las recomendaciones
    displayRecommendations();
}

// Función para exportar recomendaciones
function exportRecommendations() {
    const csvContent = 'Title,Year,Rating,Score,Matches\n' +
        recommendations.map(movie => 
            `"${movie.title}",${movie.year},${movie.voteAverage},${movie.score.toFixed(2)},${movie.matchCount}`
        ).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'recomendaciones.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}