const correctAnswers = ['B', 'A', 'B', 'A', 'B'];

const form = document.querySelector('.quiz-form');
const result = document.querySelector('.result');

form.addEventListener('submit', e => {
    e.preventDefault();
    let score = 0;
    const userAnswers = [form.q1.value, form.q2.value, form.q3.value, form.q4.value, form.q5.value];

    //check against correct answers
    userAnswers.forEach((value, index) => {
        if (value === correctAnswers[index]) {
            score += 20;
        }

    });
    console.log(score);
    console.log(result);

    //show the result
    scrollTo(0, 0);
    result.querySelector('span').textContent = `${score}%`;
    result.classList.remove('d-none');

    let output = 0;
    const timer = setInterval(() => {
        result.querySelector('span').textContent = `${output}%`;
        if (output === score) {
            clearInterval(timer);
        } else {
            output++;
        }
    }, 10);

})

