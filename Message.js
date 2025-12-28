const firebaseConfig = {
    apiKey: "AIzaSyCbG9ys8PHgfIMtO-aOhLEsRSkDss4zpXY",
    authDomain: "scf-messages.firebaseapp.com",
    databaseURL: "https://scf-messages-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "scf-messages",
    storageBucket: "scf-messages.firebasestorage.app",
    messagingSenderId: "298166319436",
    appId: "1:298166319436:web:775ae6898ca9c8b03637e9"
};

try {
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        console.log("Firebase initialized successfully");
    } else {
        console.error("Firebase SDK not loaded");
    }
} catch (error) {
    console.error("Firebase initialization error:", error);
}

const database = firebase.database();
const messagesRef = database.ref('messages');

const message_form = document.getElementById('message_form');
const sender_name = document.getElementById('sender_name');
const message_input = document.getElementById('message_input');
const anonymous_checkbox = document.getElementById('anonymous_checkbox');
const messages_list = document.getElementById('messages_list');
const count_element = document.getElementById('count');
const refresh_button = document.getElementById('refresh_button');
const submit_button = document.getElementById('submit_button');

function format_time(date) {
    try {
        const dateObj = new Date(date);
        return dateObj.toLocaleTimeString('id-ID', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false
        });
    } catch (e) {
        return '--:--';
    }
}

function format_date(date) {
    try {
        const dateObj = new Date(date);
        return dateObj.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    } catch (e) {
        return '-- --- ----';
    }
}

function display_messages(messages) {
    if (!messages_list) {
        console.error("messages_list element not found");
        return;
    }
    
    if (!messages || messages.length === 0) {
        messages_list.innerHTML = `
            <div class="empty_message">
                <i class="fas fa-comment-slash"></i>
                <p>Belum ada pesan yang dikirim.</p>
                <p>Jadilah yang pertama mengirim pesan!</p>
            </div>
        `;
        count_element.textContent = '0';
        return;
    }
    
    const sortedMessages = [...messages].sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeB - timeA;
    });
    
    count_element.textContent = messages.length;
    
    messages_list.innerHTML = '';
    
    sortedMessages.forEach((msg, index) => {
        const message_index = messages.length - index;
        const is_anonymous = !msg.sender_name || msg.sender_name.trim() === '';
        
        const message_element = document.createElement('div');
        message_element.className = 'message_item';
        
        const sender_html = is_anonymous 
            ? `<div class="message_sender">
                   <i class="fas fa-user-secret"></i> Anonymous
                   <span class="anonymous_badge">Rahasia</span>
               </div>`
            : `<div class="message_sender">
                   <i class="fas fa-user"></i> From: ${msg.sender_name}
               </div>`;
        
        message_element.innerHTML = `
            ${sender_html}
            <div class="message_content">${msg.content || ''}</div>
            <div class="message_meta">
                <span class="message_number">Message #${message_index}</span>
                <span class="message_time">${format_date(msg.timestamp)} • ${format_time(msg.timestamp)}</span>
            </div>
        `;
        
        messages_list.appendChild(message_element);
    });
}

let messages = [];

messagesRef.on('value', (snapshot) => {
    const data = snapshot.val();
    messages = [];
    
    if (data) {
        Object.keys(data).forEach((key) => {
            messages.push({
                id: key,
                ...data[key]
            });
        });
    }
    
    display_messages(messages);
}, (error) => {
    console.error("Error reading from Firebase:", error);
});

async function add_message(content, name) {
    if (!content || content.trim() === '') {
        alert('Pesan tidak boleh kosong!');
        return;
    }
    
    const is_anonymous = anonymous_checkbox.checked || !name || name.trim() === '';
    
    const new_message = {
        content: content.trim(),
        sender_name: is_anonymous ? '' : name.trim(),
        timestamp: new Date().toISOString(),
        is_anonymous: is_anonymous
    };
    
    try {
        submit_button.disabled = true;
        submit_button.innerHTML = '<i class="fas fa-spinner"></i> Mengirim...';
        
        const newRef = await messagesRef.push(new_message);
        
        message_input.value = '';
        anonymous_checkbox.checked = true;
        sender_name.value = '';
        sender_name.disabled = true;
        sender_name.placeholder = 'Anonymous';
        
        submit_button.innerHTML = '<i class="fas fa-check"></i> Terkirim!';
        submit_button.style.background = 'linear-gradient(to right, #4CAF50, #45a049)';
        
        setTimeout(() => {
            submit_button.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Message';
            submit_button.style.background = 'linear-gradient(to right, #9b48bf, #7c3799)';
            submit_button.disabled = false;
        }, 2000);
        
        document.querySelector('.messages_container').scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
        
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Gagal mengirim pesan. Silakan coba lagi.');
        
        submit_button.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Message';
        submit_button.disabled = false;
    }
}

message_form.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const message_content = message_input.value.trim();
    const user_name = sender_name.value.trim();
    
    if (!message_content) {
        alert('Harap tulis pesan terlebih dahulu!');
        message_input.focus();
        return;
    }
    
    add_message(message_content, user_name);
});

refresh_button.addEventListener('click', function() {
    const originalText = refresh_button.innerHTML;
    refresh_button.innerHTML = '<i class="fas fa-sync-alt"></i> Memuat...';
    refresh_button.disabled = true;
    
    messagesRef.once('value').then(() => {
        refresh_button.innerHTML = '<i class="fas fa-check"></i> Diperbarui!';
        
        setTimeout(() => {
            refresh_button.innerHTML = originalText;
            refresh_button.disabled = false;
        }, 1000);
    }).catch((error) => {
        console.error("Refresh error:", error);
        refresh_button.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Gagal';
        
        setTimeout(() => {
            refresh_button.innerHTML = originalText;
            refresh_button.disabled = false;
        }, 1000);
    });
});

anonymous_checkbox.addEventListener('change', function() {
    if (this.checked) {
        sender_name.value = '';
        sender_name.placeholder = 'Anonymous';
        sender_name.disabled = true;
    } else {
        sender_name.disabled = false;
        sender_name.placeholder = 'Masukkan nama Anda';
        sender_name.focus();
    }
});

anonymous_checkbox.checked = true;
if (sender_name) {
    sender_name.disabled = true;
    sender_name.placeholder = 'Anonymous';
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('SCF Messages App initialized');
});