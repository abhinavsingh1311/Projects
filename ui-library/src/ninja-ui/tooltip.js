import './styles/tooltip.css';

class Tooltip {
    constructor(e) {
        this.e = e;
        this.message = e.getAttribute('data-message');
    }
    init() {
        const tip = document.createElement('div');
        tip.classList.add('tip');
        tip.textContent = this.message;
        this.e.appendChild(tip);

        this.e.addEventListener('mouseenter', () => {
            tip.classList.add('active');
        });

        this.e.addEventListener('mouseleave', () => {
            tip.classList.remove('active');
        })
    }

};

export default Tooltip;