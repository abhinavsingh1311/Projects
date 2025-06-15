class Forecast {
    constructor() {
        this.api_key = 'kjD0wAbn3RGyWNznEZoWhQiDrAVXVx5U';
        this.weatherURI = 'http://dataservice.accuweather.com/currentconditions/v1/';
        this.cityURI = 'https://dataservice.accuweather.com/locations/v1/cities/search/';
    }

    async updateCity(city) {
        const cityDets = await this.getCity(city);
        const weather = await this.getWeather(cityDets.Key);
        // console.log(cityDets);
        // console.log(weather);
        return { cityDets, weather };
    }

    async getCity(city) {
        const query = `?apikey=${this.api_key}&q=${city}`;
        const response = await fetch(this.cityURI + query);
        const data = await response.json();
        return data[0];

    }
    async getWeather(id) {
        const query = `${id}?apikey=${this.api_key}`;
        const response = await fetch(this.weatherURI + query);
        const data = await response.json();
        return data[0];
    }
};


// const api_key = 'kjD0wAbn3RGyWNznEZoWhQiDrAVXVx5U';

// const forecastCity = async (city) => {
//     const base = 'https://dataservice.accuweather.com/locations/v1/cities/search';
//     const query = `?apikey=${api_key}&q=${city}`;
//     const response = await fetch(base + query);
//     const data = await response.json();
//     return data[0];
// };


// forecastCity('Edmonton').then(data => { return getWeather(data.Key); }).catch(err => console.log(err));

// const getWeather = async (key) => {
//     const base = 'https://dataservice.accuweather.com/currentconditions/v1/';
//     const query = `${key}?apikey=${api_key}`;
//     const response = await fetch(base + query);
//     const data = await response.json();
//     return data[0];
// };

//getWeather('420033').then(data => { console.log(data); }).catch(err => console.log(err));
