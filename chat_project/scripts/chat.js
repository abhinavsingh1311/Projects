//adding new chat docs
//setting up a real time listener to get new chats
// updating the username
//updating the room

class ChatRoom {
    constructor(room, username) {
        this.room = room;
        this.username = username;
        this.chats = db.collection('chats');
        this.unsub;
    }

    async addChat(message) {
        const now = new Date();
        const chat = {
            message,
            username: this.username,
            room: this.room,
            created_at: firebase.firestore.Timestamp.fromDate(now)
        }
        //adding new chat docs
        const response = await this.chats.add(chat);
        return response;
    };

    getChats(callback) {
        this.unsub = this.chats
            .where('room', '==', this.room)
            .orderBy('created_at').onSnapshot(snap => {
                snap.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        //update ui
                        callback(change.doc.data());
                    }
                });
            });
    };
    updateName(username) {
        this.username = username;
        localStorage.setItem('userName', username);
    }
    updateRoom(room) {
        this.room = room;
        console.log('room updated');
        if (this.unsub) {
            this.unsub();
        }
        localStorage.setItem('room', room);
    }
}

