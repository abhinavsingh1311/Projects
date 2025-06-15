//render chat templates to the DOM
//clear the list of the chats

class ChatUI {
    constructor(list) {
        this.list = list;
    }
    render(data) {
        const when = dateFns.distanceInWordsToNow(data.created_at.toDate(), { addSuffix: true });
        const html = `
        <li class="list-group-item" style="display:grid">
        <span class="username">${data.username}</span>
        <span class="message">${data.message}</span>
        <span class="time">${when}</span>
        </li>
        `;
        this.list.innerHTML += html;
    }

    clear() {
        this.list.innerHTML = "";
    }
}