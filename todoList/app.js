const addForm = document.querySelector('.add');
const addTodo = document.querySelector('.todos');
const search = document.querySelector('.search input');

addForm.addEventListener('submit', e => {
    e.preventDefault();
    //   console.log(e.target.elements.add.value);
    const todo = addForm.add.value.trim();

    if (todo.length) {
        addTodo.innerHTML += `<li class="list-group-item d-flex justify-content-between align-items-center">
    <span>${todo}</span>
    <i class="far fa-trash-alt delete"></i>
    </li>`;
    }
    addForm.reset();

});

// delete todo

addTodo.addEventListener('click', e => {
    if (e.target.classList.contains('delete')) {
        e.target.parentElement.remove();
    }
    console.log(e.target);
})

// search todo

const filter = (term) => {
    // console.log(Array.from(addTodo.children));
    Array.from(addTodo.children).filter(todo => {
        //   console.log(todo.textContent.includes(term));
        return !todo.textContent.toLowerCase().includes(term);
    }).forEach((todo) => {
        todo.classList.add('filtered');
    })

    Array.from(addTodo.children).filter(todo => todo.textContent.toLowerCase().includes(term))
        .forEach((todo) => todo.classList.remove('filtered'));
}

search.addEventListener('keyup', e => {
    const term = e.target.value.trim().toLowerCase();
    filter(term);
})