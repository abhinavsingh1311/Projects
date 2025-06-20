import Tooltip from "./ninja-ui/tooltip";
import Dropdown from './ninja-ui/dropdown';
import Tabs from './ninja-ui/tabs';
import Snackbar from './ninja-ui/snackbar';
//create a tooltip

const tooltip = new Tooltip(document.querySelector('.tooltip'));
tooltip.init();

const dropdowns = document.querySelectorAll('.dropdown');

dropdowns.forEach(dd => {
    const instance = new Dropdown(dd);
    instance.init();
});

const tabs = new Tabs(document.querySelector('.tabs'));

tabs.init();

const snackbar = new Snackbar();
snackbar.init();

const button = document.querySelector('button');
button.addEventListener('click', () => {
    snackbar.show('clicked!!');
});


