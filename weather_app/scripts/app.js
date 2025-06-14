const cityForm = document.querySelector('form');
const card = document.querySelector('.card');
const details = document.querySelector('.details');
const time = document.querySelector('img.time');
const icon = document.querySelector('.icon img');

const updateUI = (data) => {
    const cityDets = data.cityDets;
    const weather = data.weather;

    details.innerHTML = `
     <h5 class="my-3">${cityDets.EnglishName}</h5>
     <div class="my-3">${weather.WeatherText}</div>
     <div class="display-4 my-4">
        <span>${weather.Temperature.Metric.Value}</span>
        <span>&deg;C</span>
     </div>
    `;

    const iconSrc = `img/icons/${weather.WeatherIcon}.svg`;

    let timeSrc = null;
    if (weather.IsDayTime) {
        timeSrc = 'day';
    } else {
        timeSrc = 'night';
    }
    time.setAttribute('src', `img/${timeSrc}.svg`);
    icon.setAttribute('src', iconSrc);

    if (card.classList.contains('d-none')) {
        card.classList.remove('d-none');
    }


}

const updateCity = async (city) => {
    const cityDets = await forecastCity(city);
    const weather = await getWeather(cityDets.Key);
    // console.log(cityDets);
    // console.log(weather);
    return {
        cityDets: cityDets,
        weather: weather
    };
};

cityForm.addEventListener('submit', e => {
    e.preventDefault();

    const city = cityForm.city.value;
    cityForm.reset();

    updateCity(city)
        .then(data => updateUI(data)).catch(err => console.log(err));

    localStorage.setItem('city', city);

})

if (localStorage.getItem('city')) {
    updateCity(localStorage.getItem('city'))
        .then(data => updateUI(data)).catch(err => console.log(err));
}