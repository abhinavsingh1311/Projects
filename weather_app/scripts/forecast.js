const api_key = 'kjD0wAbn3RGyWNznEZoWhQiDrAVXVx5U';

const forecastCity = async (city) => {
    const base = 'https://dataservice.accuweather.com/locations/v1/cities/search';
    const query = `?apikey=${api_key}&q=${city}`;
    const response = await fetch(base + query);
    const data = await response.json();
    return data[0];
};


forecastCity('Edmonton').then(data => { return getWeather(data.Key); }).catch(err => console.log(err));

const getWeather = async (key) => {
    const base = 'https://dataservice.accuweather.com/currentconditions/v1/';
    const query = `${key}?apikey=${api_key}`;
    const response = await fetch(base + query);
    const data = await response.json();
    return data[0];
};

//getWeather('420033').then(data => { console.log(data); }).catch(err => console.log(err));