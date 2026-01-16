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
        showError("Firebase SDK tidak dapat dimuat. Silakan refresh halaman.");
    }
} catch (error) {
    console.error("Firebase initialization error:", error);
    showError("Gagal menginisialisasi Firebase. Silakan refresh halaman.");
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

const loading_modal = document.getElementById('loading_modal');
const success_modal = document.getElementById('success_modal');
const error_modal = document.getElementById('error_modal');

let currentMessageReplying = null;
let messages = [];

function format_time(date) {
    try {
        const dateObj = new Date(date);
        return dateObj.toLocaleTimeString('id-ID', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false
        });
    } catch(e) {
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
    } catch(e) {
        return '-- --- ----';
    }
}

function showLoading() {
    loading_modal.style.display = 'flex';
}

function hideLoading() {
    loading_modal.style.display = 'none';
}

function showSuccess() {
    success_modal.style.display = 'flex';
}

function closeSuccessModal() {
    success_modal.style.display = 'none';
}

function showError(message = 'Terjadi kesalahan. Silakan coba lagi.') {
    document.getElementById('error_message').textContent = message;
    error_modal.style.display = 'flex';
}

function closeErrorModal() {
    error_modal.style.display = 'none';
}

function display_replies(messageId, replies, container, isExpanded = false) {
    if (!replies || Object.keys(replies).length === 0) {
        container.innerHTML = '';
        return;
    }
    
    const repliesArray = Object.entries(replies).map(([key, value]) => ({
        id: key,
        ...value
    })).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    let repliesHTML = '';
    
    repliesArray.forEach(reply => {
        const is_anonymous = !reply.reply_name || reply.reply_name.trim() === '';
        const replyTime = reply.timestamp ? `${format_date(reply.timestamp)} • ${format_time(reply.timestamp)}` : '';
        
        repliesHTML += `
            <div class="reply_item">
                <div class="reply_content">${reply.content || ''}</div>
                <div class="reply_meta">
                    <span class="reply_sender ${is_anonymous ? 'anonymous' : ''}">
                        ${is_anonymous ? '<i class="fas fa-user-secret"></i> Anonymous' : `<i class="fas fa-user"></i> ${reply.reply_name}`}
                    </span>
                    <span class="reply_time">${replyTime}</span>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = `
        <div class="replies_section ${isExpanded ? 'replies_expanded' : 'replies_collapsed'}">
            <div class="replies_header">
                <i class="fas fa-comments"></i>
                <span>${repliesArray.length} Balasan</span>
            </div>
            <div class="replies_list">
                ${repliesHTML}
            </div>
            <div class="replies_toggle_container">
                <button class="hide_replies_btn" data-message-id="${messageId}">
                    <i class="fas fa-chevron-up"></i> Sembunyikan Balasan
                </button>
            </div>
        </div>
    `;
    
    if (isExpanded) {
        const hideBtn = container.querySelector('.hide_replies_btn');
        hideBtn.addEventListener('click', function() {
            const section = this.closest('.replies_section');
            section.classList.remove('replies_expanded');
            section.classList.add('replies_collapsed');
            setTimeout(() => {
                const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
                const viewBtn = messageElement.querySelector('.view_replies_btn');
                if (viewBtn) viewBtn.style.display = 'flex';
            }, 300);
        });
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
        const hasReplies = msg.replies && Object.keys(msg.replies).length > 0;
        const replyCount = hasReplies ? Object.keys(msg.replies).length : 0;
        const messageTime = msg.timestamp ? `${format_date(msg.timestamp)} • ${format_time(msg.timestamp)}` : '';
        
        const message_element = document.createElement('div');
        message_element.className = 'message_item';
        message_element.dataset.messageId = msg.id;
        
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
            <div class="message_footer">
                <div class="message_meta">
                    <span class="message_number">Message #${message_index}</span>
                    <span class="message_time">${messageTime}</span>
                </div>
                ${hasReplies ? 
                    `<div class="reply_count">
                        <i class="fas fa-comments"></i>
                        <span>${replyCount}</span>
                    </div>` : ''
                }
            </div>
            <button class="reply_button" data-message-id="${msg.id}">
                <i class="fas fa-reply"></i> Balas
            </button>
            ${hasReplies ? 
                `<button class="view_replies_btn" data-message-id="${msg.id}">
                    <i class="fas fa-chevron-down"></i> Lihat ${replyCount} Balasan
                </button>` : ''
            }
            <div class="replies_container" id="replies_${msg.id}"></div>
        `;
        
        messages_list.appendChild(message_element);
        
        if (hasReplies) {
            const viewBtn = message_element.querySelector('.view_replies_btn');
            viewBtn.addEventListener('click', function() {
                const messageId = this.dataset.messageId;
                const repliesContainer = document.getElementById(`replies_${messageId}`);
                display_replies(messageId, msg.replies, repliesContainer, true);
                this.style.display = 'none';
            });
        }
    });
    
    document.querySelectorAll('.reply_button').forEach(button => {
        button.addEventListener('click', function() {
            const messageId = this.dataset.messageId;
            showReplyForm(messageId);
        });
    });
}

function showReplyForm(messageId) {
    const existingForm = document.querySelector('.reply_form_template.active');
    if (existingForm) {
        existingForm.remove();
    }
    
    currentMessageReplying = messageId;
    
    const template = document.getElementById('reply_template');
    const replyForm = template.cloneNode(true);
    replyForm.id = `reply_form_${messageId}`;
    replyForm.classList.add('active');
    
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    const repliesContainer = messageElement.querySelector('.replies_container');
    
    const replyButton = messageElement.querySelector('.reply_button');
    messageElement.insertBefore(replyForm, repliesContainer);
    
    const closeBtn = replyForm.querySelector('.close_reply_btn');
    const cancelBtn = replyForm.querySelector('.cancel_reply_btn');
    const submitBtn = replyForm.querySelector('.submit_reply_btn');
    const anonymousCheckbox = replyForm.querySelector('.reply_anonymous_checkbox');
    const nameInput = replyForm.querySelector('.reply_name_input');
    const contentInput = replyForm.querySelector('.reply_content_input');
    
    anonymousCheckbox.addEventListener('change', function() {
        if (this.checked) {
            nameInput.value = '';
            nameInput.placeholder = 'Anonymous';
            nameInput.disabled = true;
        } else {
            nameInput.disabled = false;
            nameInput.placeholder = 'Masukkan nama Anda';
            nameInput.focus();
        }
    });
    
    anonymousCheckbox.checked = true;
    nameInput.disabled = true;
    nameInput.placeholder = 'Anonymous';
    
    closeBtn.addEventListener('click', function() {
        replyForm.remove();
        currentMessageReplying = null;
    });
    
    cancelBtn.addEventListener('click', function() {
        replyForm.remove();
        currentMessageReplying = null;
    });
    
    submitBtn.addEventListener('click', async function() {
        const content = contentInput.value.trim();
        const name = nameInput.value.trim();
        
        if (!content) {
            showError('Harap tulis balasan terlebih dahulu!');
            contentInput.focus();
            return;
        }
        
        await addReply(messageId, content, name);
        replyForm.remove();
        currentMessageReplying = null;
    });
}

async function addReply(messageId, content, name) {
    const is_anonymous = !name || name.trim() === '';
    const newReply = {
        content: content.trim(),
        reply_name: is_anonymous ? '' : name.trim(),
        timestamp: new Date().toISOString(),
        is_anonymous: is_anonymous
    };
    
    try {
        showLoading();
        const replyRef = messagesRef.child(messageId).child('replies');
        await replyRef.push(newReply);
        
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        hideLoading();
        
    } catch (error) {
        console.error('Error sending reply:', error);
        hideLoading();
        showError('Gagal mengirim balasan. Silakan coba lagi.');
    }
}

async function add_message(content, name) {
    if (!content || content.trim() === '') {
        showError('Pesan tidak boleh kosong!');
        return;
    }
    
    const is_anonymous = anonymous_checkbox.checked || !name || name.trim() === '';
    const new_message = {
        content: content.trim(),
        sender_name: is_anonymous ? '' : name.trim(),
        timestamp: new Date().toISOString(),
        is_anonymous: is_anonymous,
        replies: {}
    };
    
    try {
        submit_button.disabled = true;
        submit_button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengirim...';
        showLoading();
        
        await messagesRef.push(new_message);
        
        message_input.value = '';
        anonymous_checkbox.checked = true;
        sender_name.value = '';
        sender_name.disabled = true;
        sender_name.placeholder = 'Anonymous';
        
        hideLoading();
        showSuccess();
        
        setTimeout(() => {
            submit_button.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Message';
            submit_button.disabled = false;
        }, 2000);
        
        document.querySelector('.messages_container').scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
        
    } catch (error) {
        console.error('Error sending message:', error);
        hideLoading();
        showError('Gagal mengirim pesan. Silakan coba lagi.');
        submit_button.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Message';
        submit_button.disabled = false;
    }
}

message_form.addEventListener('submit', async function(e) {
    e.preventDefault();
    const message_content = message_input.value.trim();
    const user_name = sender_name.value.trim();
    
    if (!message_content) {
        showError('Harap tulis pesan terlebih dahulu!');
        message_input.focus();
        return;
    }
    
    add_message(message_content, user_name);
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

refresh_button.addEventListener('click', function() {
    const originalText = refresh_button.innerHTML;
    refresh_button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memuat...';
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
    showError('Gagal memuat pesan. Silakan refresh halaman.');
});

document.addEventListener('DOMContentLoaded', function() {
    anonymous_checkbox.checked = true;
    if (sender_name) {
        sender_name.disabled = true;
        sender_name.placeholder = 'Anonymous';
    }
    
    console.log('SCF Messages App dengan fitur balasan telah diinisialisasi');
    
    window.addEventListener('click', function(event) {
        if (event.target === success_modal) {
            closeSuccessModal();
        }
        if (event.target === error_modal) {
            closeErrorModal();
        }
    });
});