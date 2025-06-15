//dom queries
const chatList = document.querySelector('.chat-list');
const newChatForm = document.querySelector('.new-chat');
const newNameForm = document.querySelector('.new-name');
const feedback = document.querySelector('.update-msg');
const newRoom = document.querySelector('.chat-rooms');
//add a new chat
newChatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = newChatForm.message.value.trim();
    chatRoom.addChat(message).then(() => {
        newChatForm.reset();
    }).catch((err) => {
        console.log(err);
    });
});

//update username

newNameForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = newNameForm.name.value.trim();
    chatRoom.updateName(username);
    //reset form
    newNameForm.reset();
    //show then hide the msg
    feedback.innerText = `Your name was updated to ${username}`;
    setTimeout(() => {
        feedback.innerText = '';
    }, 3000);
});

//update room

newRoom.addEventListener('click', e => {
    if (e.target.tagName === 'BUTTON') {
        chatUI.clear();
        chatRoom.updateRoom(e.target.getAttribute('id'));
        chatRoom.getChats(chat => chatUI.render(chat));
    }
})


//local storage for username

const username = localStorage.username ? localStorage.username : 'anon';

//local storage for room

const room = localStorage.room ? localStorage.room : 'general';

//class instances
const chatUI = new ChatUI(chatList);
const chatRoom = new ChatRoom(room, username);

chatRoom.getChats((data) => {
    chatUI.render(data);
});
