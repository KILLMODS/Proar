// Инициализация переменных
let currentUser = null;
let currentChatId = null;
let chatsUnsub = null;
let messagesUnsub = null;
let replyToMessageId = null;
let themeDark = true;

// Тема
if (localStorage.getItem('theme') === 'light') {
  themeDark = false; document.body.classList.remove('dark');
}
document.getElementById('theme-toggle').onclick = () => {
  themeDark = !themeDark; document.body.classList.toggle('dark', themeDark);
  localStorage.setItem('theme', themeDark ? 'dark' : 'light');
};

// Firebase auth state
firebase.auth().onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    await db.collection('users').doc(currentUser.uid).set({ username: currentUser.email, name:'', avatarUrl:'', status:'Онлайн' }, { merge: true });
    document.getElementById('auth-modal')?.remove();
    await loadUserProfile();
    await loadChats();
    const lastChatId = localStorage.getItem('lastChatId');
    if (lastChatId) await openChat(lastChatId);
  } else {
    showAuthModal();
  }
});

// Авторизация и регистрация
function showAuthModal() {
  if (document.getElementById('auth-modal')) {
    document.getElementById('auth-modal').style.display='flex';
    return;
  }
  const div=document.createElement('div');
  div.id='auth-modal';
  div.className='modal';
  div.innerHTML=`
    <div style="background:#222; padding:20px; border-radius:8px; width:340px; color:#fff; display:flex; flex-direction:column; gap:8px;">
      <h3 style="margin:0 0 6px 0;">Войти / Регистрация</h3>
      <input id="auth-email" placeholder="Email" style="width:100%; padding:8px;"/>
      <input id="auth-password" placeholder="Пароль" type="password" style="width:100%; padding:8px;"/>
      <div style="display:flex; justify-content:space-between;">
        <button class="btn" onclick="login()">Войти</button>
        <button class="btn-secondary" onclick="register()">Регистрация</button>
      </div>
    </div>`;
  document.body.appendChild(div);
}

async function login() {
  const email=document.getElementById('auth-email').value.trim();
  const pass=document.getElementById('auth-password').value.trim();
  if (!email || !pass) { alert('Введите email и пароль'); return; }
  try {
    const cred=await firebase.auth().signInWithEmailAndPassword(email, pass);
    currentUser=cred.user;
    document.getElementById('auth-modal')?.remove();
  } catch(e) { alert(e.message); }
}

async function register() {
  const email=document.getElementById('auth-email').value.trim();
  const pass=document.getElementById('auth-password').value.trim();
  if (!email || !pass) { alert('Введите email и пароль'); return; }
  try {
    const cred=await firebase.auth().createUserWithEmailAndPassword(email, pass);
    currentUser=cred.user;
    // Показываем форму профиля
    showProfileSetup();
  } catch(e) { alert(e.message); }
}

// Обработка выхода
function logout() {
  firebase.auth().signOut();
  currentUser=null;
  if (chatsUnsub) chatsUnsub();
  if (messagesUnsub) messagesUnsub();
  document.getElementById('chats').innerHTML='';
  document.getElementById('messages').innerHTML='';
  document.getElementById('chat-title').textContent='Выберите чат';
  alert('Вы вышли');
  showAuthModal();
}

// Загрузка профиля
async function loadUserProfile() {
  if (!currentUser) return;
  const doc=await db.collection('users').doc(currentUser.uid).get();
  if (doc.exists) {
    const data=doc.data();
    // Можно заполнить поля профиля
  }
}

// Форма регистрации профиля
function showProfileSetup() {
  const div=document.createElement('div');
  div.id='auth-modal';
  div.className='modal';
  div.innerHTML=`
    <div style="background:#222; padding:20px; border-radius:8px; width:340px; color:#fff; display:flex; flex-direction:column; gap:8px;">
      <h3>Заполните профиль</h3>
      <input id="profile-name" placeholder="Имя" style="width:100%; padding:8px;"/>
      <input id="profile-username" placeholder="Username" style="width:100%; padding:8px;"/>
      <input id="profile-avatar" placeholder="Аватар URL (по желанию)" style="width:100%; padding:8px;"/>
      <button class="btn" onclick="saveProfileSetup()">Сохранить</button>
    </div>`;
  document.body.appendChild(div);
}

async function saveProfileSetup() {
  const name=document.getElementById('profile-name').value.trim();
  const username=document.getElementById('profile-username').value.trim();
  const avatarUrl=document.getElementById('profile-avatar').value.trim();
  if (!name || !username) { alert('Заполните имя и username'); return; }
  await db.collection('users').doc(currentUser.uid).set({ name, username, avatarUrl }, { merge:true });
  document.getElementById('auth-modal')?.remove();
  await loadChats();
  const lastChatId=localStorage.getItem('lastChatId');
  if (lastChatId) await openChat(lastChatId);
}

// Загрузка чатов
async function loadChats() {
  if (chatsUnsub) chatsUnsub();
  if (!currentUser) return;
  const q= db.collection('chats')
    .where('members','array-contains', currentUser.uid)
    .orderBy('updatedAt','desc');
  chatsUnsub=q.onSnapshot(snapshot => {
    const container=document.getElementById('chats');
    container.innerHTML='';
    snapshot.forEach(doc => {
      const chat=doc.data();
      const el=document.createElement('div');
      el.className='chat-item';
      el.id='chat-'+doc.id;
      el.onclick= ()=>{ openChat(doc.id); };
      if (currentChatId===doc.id) el.classList.add('active');

      // Аватар
      const avatar=document.createElement('div');
      avatar.className='avatar';
      avatar.textContent= (chat.name?.charAt(0)||'Ч').toUpperCase();
      if (chat.avatarUrl) {
        avatar.style.backgroundImage=`url(${chat.avatarUrl})`;
        avatar.style.backgroundSize='cover'; avatar.style.backgroundPosition='center'; avatar.textContent='';
      }

      // Инфа
      const info=document.createElement('div');
      info.className='chat-info';
      info.innerHTML= `
        <div class="chat-name">${chat.name||'Чат'}</div>
        <div class="chat-last-message">Участников: ${chat.members?.length||0}</div>
      `;

      // Надпись с непрочитанными
      const unreadBadge=document.createElement('div');
      unreadBadge.className='unread-badge';
      unreadBadge.style.display='none';
      el.appendChild(unreadBadge);

      el.appendChild(avatar);
      el.appendChild(info);
      container.appendChild(el);
    });
  });
}

// Открытие чата
async function openChat(chatId) {
  const chatRef= db.collection('chats').doc(chatId);
  const chatDoc= await chatRef.get();
  if (!chatDoc.exists) return;
  const chatData=chatDoc.data();
  if (!chatData.members.includes(currentUser.uid)) { alert('Этот чат недоступен вам'); return; }
  currentChatId=chatId;
  localStorage.setItem('lastChatId', chatId);
  document.querySelectorAll('.chat-item').forEach(e=>e.classList.remove('active'));
  const chatEl=document.getElementById('chat-'+chatId);
  if (chatEl) chatEl.classList.add('active');

  document.getElementById('chat-title').textContent='Чат: '+(chatData.name||'Чат');

  // Сброс счетчика
  const badgeEl=document.querySelector('#chat-'+chatId+' .unread-badge');
  if (badgeEl) {
    badgeEl.textContent='0';
    badgeEl.style.display='none';
  }

  // Загружаем сообщения
  if (messagesUnsub) messagesUnsub();
  messagesUnsub= chatRef.collection('messages')
    .orderBy('createdAt','asc')
    .onSnapshot(snapshot => {
      const div=document.getElementById('messages');
      div.innerHTML='';
      snapshot.forEach(doc=>{
        const msg=doc.data();
        const msgDiv=document.createElement('div');
        msgDiv.className='message ' + (msg.senderId===currentUser.uid?'sent':'recv');
        msgDiv.setAttribute('data-id',doc.id);

        if (msg.replyToId) {
          const reply=document.createElement('div');
          reply.className='reply-preview';
          reply.textContent='Цитата: '+(msg.replyToText||'');
          msgDiv.appendChild(reply);
        }

        if (msg.text) {
          const t=document.createElement('div');
          t.textContent=decodeText(msg.text);
          msgDiv.appendChild(t);
        }
        if (msg.fileUrl) {
          const a=document.createElement('a');
          a.href=msg.fileUrl; a.target='_blank'; a.textContent='Файл';
          msgDiv.appendChild(a);
        }

        const time=document.createElement('div');
        time.className='time';
        const date=new Date((msg.createdAt?.seconds||Date.now()/1000)*1000);
        time.textContent= date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        msgDiv.appendChild(time);

        // Контекстное меню
        msgDiv.oncontextmenu=(e)=>{
          e.preventDefault();
          showMessageContextMenu(e.pageX, e.pageY, doc.id, msg);
        };

        if (msg.senderId!==currentUser.uid) {
          msgDiv.style.opacity='0.8';
        }

        div.appendChild(msgDiv);
      });
      div.scrollTop=div.scrollHeight;

      // При новом сообщении, если чат не активен, увеличить счетчик
      if (currentChatId!==chatId) {
        const badgeEl=document.querySelector('#chat-'+chatId+' .unread-badge');
        if (badgeEl) {
          let count=parseInt(badgeEl.textContent)||0;
          count++;
          badgeEl.textContent=count;
          badgeEl.style.display='block';
        }
        updateUnreadCount();
      }
    });
}

// Отправка сообщений
async function sendMessage() {
  const text=document.getElementById('message-input').value.trim();
  const fileInput=document.getElementById('file-input');
  if (!currentChatId) { alert('Выберите чат'); return; }
  if (!text && fileInput.files.length===0) { alert('Пожалуйста, введите сообщение или прикрепите файл'); return; }

  let fileUrl='';
  if (fileInput.files.length>0) {
    const file=fileInput.files[0];
    const ref=storage.ref().child('files/'+Date.now()+'_'+file.name);
    await ref.put(file);
    fileUrl= await ref.getDownloadURL();
  }

  const encodedText=text?encodeText(text):null;
  await db.collection('chats').doc(currentChatId).collection('messages').add({
    text: encodedText,
    fileUrl,
    senderId: currentUser.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    replyToId: replyToMessageId,
    replyToText: replyToMessageId ? (document.querySelector(`[data-id="${replyToMessageId}"]`)?.textContent || '') : null
  });
  document.getElementById('message-input').value='';
  document.getElementById('file-input').value='';
  replyToMessageId=null;
}

// Отправка полного сообщения в полноэкранный чат
function sendFullMessage() {
  const msg=document.getElementById('full-chat-message').value.trim();
  if (!msg || !currentChatId) return;
  const encoded=encodeText(msg);
  db.collection('chats').doc(currentChatId).collection('messages').add({
    text:encoded,
    senderId: currentUser.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  document.getElementById('full-chat-message').value='';
}

// Контекстное меню
function showMessageContextMenu(x,y,msgId,msgData) {
  const menu=document.getElementById('context-menu');
  menu.innerHTML='';
  menu.style.left=x+'px'; menu.style.top=y+'px'; menu.style.display='block';

  const btnDel=document.createElement('div');
  btnDel.className='ctx-item'; btnDel.innerHTML='Удалить'; btnDel.onclick=()=>{ deleteMessage(msgId); hideContextMenu(); };
  const btnEdit=document.createElement('div');
  btnEdit.className='ctx-item'; btnEdit.innerHTML='Редактировать'; btnEdit.onclick=()=>{ if (msgData.senderId!==currentUser.uid) { alert('Недоступно'); return; } editMessage(msgId, msgData.text); hideContextMenu(); };
  const btnReport=document.createElement('div');
  btnReport.className='ctx-item'; btnReport.innerHTML='Пожаловаться'; btnReport.onclick=()=>{ showReportForm(msgId); hideContextMenu(); };
  const btnViewProfile=document.createElement('div');
  btnViewProfile.className='ctx-item'; btnViewProfile.innerHTML='Профиль'; btnViewProfile.onclick=()=>{ viewUserProfile(msgData.senderId); hideContextMenu(); };
  const btnViewChat=document.createElement('div');
  btnViewChat.className='ctx-item'; btnViewChat.innerHTML='Инфо о чате'; btnViewChat.onclick=()=>{ viewChatInfo(currentChatId); hideContextMenu(); };
  if (currentUser && currentUser.email==='mcarenko.artem.2012@gmail.com') {
    const devBadge=document.createElement('div');
    devBadge.className='ctx-item'; devBadge.innerHTML='🧑‍💻 Официальный аккаунт';
    devBadge.style.fontWeight='bold'; devBadge.style.background='#3b82f6'; devBadge.style.color='#fff';
    devBadge.onclick=()=>{ alert('Это официальный аккаунт разработчика'); hideContextMenu(); };
    menu.appendChild(devBadge);
  }

  menu.appendChild(btnDel);
  menu.appendChild(btnEdit);
  menu.appendChild(btnReport);
  menu.appendChild(btnViewProfile);
  menu.appendChild(btnViewChat);
}
function hideContextMenu() {
  document.getElementById('context-menu').style.display='none';
}

// Удаление/редактирование
async function deleteMessage(msgId) {
  if (!currentChatId || !msgId) return;
  await db.collection('chats').doc(currentChatId).collection('messages').doc(msgId).delete();
}
async function editMessage(msgId, currentText) {
  const newText=prompt('Редактировать сообщение', decodeText(currentText));
  if (newText===null) return;
  await db.collection('chats').doc(currentChatId).collection('messages').doc(msgId).update({ text: encodeText(newText) });
}

// Жалоба
function showReportForm(msgId) {
  document.getElementById('report-form').dataset.msgId=msgId;
  document.getElementById('report-reason').value='spam';
  document.getElementById('report-description').value='';
  document.getElementById('report-form').style.display='flex';
}
function closeReport() { document.getElementById('report-form').style.display='none'; }
async function submitReport() {
  const msgId= document.getElementById('report-form').dataset.msgId;
  const reason= document.getElementById('report-reason').value;
  const description= document.getElementById('report-description').value;
  if (!msgId) return;
  await db.collection('reports').add({
    messageId: msgId,
    chatId: currentChatId,
    reporterId: currentUser.uid,
    reason,
    description,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  alert('Жалоба отправлена');
  closeReport();
}

// Вспомогательные функции
function viewUserProfile(userId) {
  alert('Профиль пользователя: '+userId);
}
function viewChatInfo(chatId) {
  alert('Информация о чате: '+chatId);
}
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('hidden');
}
function showProfile() {
  if (!currentUser) { alert('Не авторизованы'); return; }
  db.collection('users').doc(currentUser.uid).get().then(doc => {
    if (doc.exists) {
      const data=doc.data();
      document.getElementById('profile-img').value=data.avatarUrl||'';
      document.getElementById('profile-name').value=data.name||'';
      document.getElementById('profile-username').value=data.username||'';
      document.getElementById('profile-status').value=data.status||'';
    }
    document.getElementById('profile-panel').classList.add('show');
    document.getElementById('profile-panel').style.display='flex';
  });
}
function closeProfile() {
  document.getElementById('profile-panel').classList.remove('show');
  setTimeout(()=>{ document.getElementById('profile-panel').style.display='none'; },300);
}
async function saveProfile() {
  const name=document.getElementById('profile-name').value.trim();
  const username=document.getElementById('profile-username').value.trim();
  const avatarUrl=document.getElementById('profile-avatar').value.trim();
  if (!name || !username) { alert('Заполните имя и username'); return; }
  await db.collection('users').doc(currentUser.uid).set({ name, username, avatarUrl }, { merge:true });
  closeProfile();
  await loadChats();
}
function openExtendedChatCreation() {
  document.getElementById('extended-chat-creation').classList.add('show');
  document.getElementById('extended-chat-creation').style.display='flex';
}
function closeExtendedChat() {
  document.getElementById('extended-chat-creation').classList.remove('show');
  setTimeout(()=>{ document.getElementById('extended-chat-creation').style.display='none'; },300);
}
async function createExtendedChat() {
  const name=document.getElementById('ext-chat-name').value.trim();
  const membersStr=document.getElementById('ext-chat-members').value.trim();
  if (!name || !membersStr) { alert('Заполните название и участников'); return; }
  const members=membersStr.split(',').map(s=>s.trim()).filter(s=>s);
  if (!members.includes(currentUser.email)) members.push(currentUser.email);
  await db.collection('chats').add({ name, members, createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  closeExtendedChat();
  await loadChats();
}
function toggleSearchResults() {
  document.getElementById('search-panel').classList.toggle('active');
}
function searchEntities() {
  // Можно реализовать поиск по именам или юзернеймам
}

// Отправка в полноэкранный чат
function showFullChat() {
  if (!currentChatId) { alert('Нет выбранного чата'); return; }
  document.getElementById('full-chat-title').textContent='Чат: '+(document.getElementById('chat-title').textContent);
  document.getElementById('full-chat-panel').classList.add('show');
  document.getElementById('full-chat-panel').style.display='flex';
  loadFullChatMessages();
}
function closeFullChat() {
  document.getElementById('full-chat-panel').classList.remove('show');
  setTimeout(()=>{ document.getElementById('full-chat-panel').style.display='none'; },300);
}
async function loadFullChatMessages() {
  const container=document.getElementById('full-chat-messages');
  container.innerHTML='';
  const msgs=await db.collection('chats').doc(currentChatId).collection('messages')
    .orderBy('createdAt','asc').get();
  msgs.forEach(doc => {
    const msg=doc.data();
    const div=document.createElement('div');
    div.className='message ' + (msg.senderId===currentUser.uid?'sent':'recv');
    if (msg.replyToId) {
      const reply=document.createElement('div');
      reply.className='reply-preview';
      reply.textContent='Цитата: '+(msg.replyToText||'');
      div.appendChild(reply);
    }
    if (msg.text) {
      const t=document.createElement('div');
      t.textContent=decodeText(msg.text);
      div.appendChild(t);
    }
    if (msg.fileUrl) {
      const a=document.createElement('a');
      a.href=msg.fileUrl; a.target='_blank'; a.textContent='Файл';
      div.appendChild(a);
    }
    const time=document.createElement('div');
    time.className='time';
    const date=new Date((msg.createdAt?.seconds||Date.now()/1000)*1000);
    time.textContent= date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    div.appendChild(time);
    container.appendChild(div);
  });
  container.scrollTop=container.scrollHeight;
}

// Отправка сообщения в полноэкранный чат
function sendFullMessage() {
  const msg=document.getElementById('full-chat-message').value.trim();
  if (!msg || !currentChatId) return;
  const encoded=encodeText(msg);
  db.collection('chats').doc(currentChatId).collection('messages').add({
    text:encoded,
    senderId: currentUser.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  document.getElementById('full-chat-message').value='';
}

// Обработка контекстного меню
function showMessageContextMenu(x,y,msgId,msgData) {
  const menu=document.getElementById('context-menu');
  menu.innerHTML='';
  menu.style.left=x+'px'; menu.style.top=y+'px'; menu.style.display='block';

  const btnDel=document.createElement('div');
  btnDel.className='ctx-item'; btnDel.innerHTML='Удалить'; btnDel.onclick=()=>{ deleteMessage(msgId); hideContextMenu(); };
  const btnEdit=document.createElement('div');
  btnEdit.className='ctx-item'; btnEdit.innerHTML='Редактировать'; btnEdit.onclick=()=>{ if (msgData.senderId!==currentUser.uid) { alert('Недоступно'); return; } editMessage(msgId, msgData.text); hideContextMenu(); };
  const btnReport=document.createElement('div');
  btnReport.className='ctx-item'; btnReport.innerHTML='Пожаловаться'; btnReport.onclick=()=>{ showReportForm(msgId); hideContextMenu(); };
  const btnViewProfile=document.createElement('div');
  btnViewProfile.className='ctx-item'; btnViewProfile.innerHTML='Профиль'; btnViewProfile.onclick=()=>{ viewUserProfile(msgData.senderId); hideContextMenu(); };
  const btnViewChat=document.createElement('div');
  btnViewChat.className='ctx-item'; btnViewChat.innerHTML='Инфо о чате'; btnViewChat.onclick=()=>{ viewChatInfo(currentChatId); hideContextMenu(); };
  if (currentUser && currentUser.email==='mcarenko.artem.2012@gmail.com') {
    const devBadge=document.createElement('div');
    devBadge.className='ctx-item'; devBadge.innerHTML='🧑‍💻 Официальный аккаунт';
    devBadge.style.fontWeight='bold'; devBadge.style.background='#3b82f6'; devBadge.style.color='#fff';
    devBadge.onclick=()=>{ alert('Это официальный аккаунт разработчика'); hideContextMenu(); };
    menu.appendChild(devBadge);
  }

  menu.appendChild(btnDel);
  menu.appendChild(btnEdit);
  menu.appendChild(btnReport);
  menu.appendChild(btnViewProfile);
  menu.appendChild(btnViewChat);
}
function hideContextMenu() {
  document.getElementById('context-menu').style.display='none';
}

// Удаление и редактирование
async function deleteMessage(msgId) {
  if (!currentChatId || !msgId) return;
  await db.collection('chats').doc(currentChatId).collection('messages').doc(msgId).delete();
}
async function editMessage(msgId, currentText) {
  const newText=prompt('Редактировать сообщение', decodeText(currentText));
  if (newText===null) return;
  await db.collection('chats').doc(currentChatId).collection('messages').doc(msgId).update({ text: encodeText(newText) });
}

// Жалоба
function showReportForm(msgId) {
  document.getElementById('report-form').dataset.msgId=msgId;
  document.getElementById('report-reason').value='spam';
  document.getElementById('report-description').value='';
  document.getElementById('report-form').style.display='flex';
}
function closeReport() { document.getElementById('report-form').style.display='none'; }
async function submitReport() {
  const msgId= document.getElementById('report-form').dataset.msgId;
  const reason= document.getElementById('report-reason').value;
  const description= document.getElementById('report-description').value;
  if (!msgId) return;
  await db.collection('reports').add({
    messageId: msgId,
    chatId: currentChatId,
    reporterId: currentUser.uid,
    reason,
    description,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  alert('Жалоба отправлена');
  closeReport();
}

// Вспомогательные функции
function viewUserProfile(userId) {
  alert('Профиль пользователя: '+userId);
}
function viewChatInfo(chatId) {
  alert('Информация о чате: '+chatId);
}
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('hidden');
}
function showProfile() {
  if (!currentUser) { alert('Не авторизованы'); return; }
  db.collection('users').doc(currentUser.uid).get().then(doc => {
    if (doc.exists) {
      const data=doc.data();
      document.getElementById('profile-img').value=data.avatarUrl||'';
      document.getElementById('profile-name').value=data.name||'';
      document.getElementById('profile-username').value=data.username||'';
      document.getElementById('profile-status').value=data.status||'';
    }
    document.getElementById('profile-panel').classList.add('show');
    document.getElementById('profile-panel').style.display='flex';
  });
}
function closeProfile() {
  document.getElementById('profile-panel').classList.remove('show');
  setTimeout(()=>{ document.getElementById('profile-panel').style.display='none'; },300);
}
async function saveProfile() {
  const name=document.getElementById('profile-name').value.trim();
  const username=document.getElementById('profile-username').value.trim();
  const avatarUrl=document.getElementById('profile-avatar').value.trim();
  if (!name || !username) { alert('Заполните имя и username'); return; }
  await db.collection('users').doc(currentUser.uid).set({ name, username, avatarUrl }, { merge:true });
  closeProfile();
  await loadChats();
}
function openExtendedChatCreation() {
  document.getElementById('extended-chat-creation').classList.add('show');
  document.getElementById('extended-chat-creation').style.display='flex';
}
function closeExtendedChat() {
  document.getElementById('extended-chat-creation').classList.remove('show');
  setTimeout(()=>{ document.getElementById('extended-chat-creation').style.display='none'; },300);
}
async function createExtendedChat() {
  const name=document.getElementById('ext-chat-name').value.trim();
  const membersStr=document.getElementById('ext-chat-members').value.trim();
  if (!name || !membersStr) { alert('Заполните название и участников'); return; }
  const members=membersStr.split(',').map(s=>s.trim()).filter(s=>s);
  if (!members.includes(currentUser.email)) members.push(currentUser.email);
  await db.collection('chats').add({ name, members, createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  closeExtendedChat();
  await loadChats();
}
function toggleSearchResults() {
  document.getElementById('search-panel').classList.toggle('active');
}
function searchEntities() {
  // Можно реализовать поиск по именам или юзернеймам
}

// Просмотр полного чата
function showFullChat() {
  if (!currentChatId) { alert('Нет выбранного чата'); return; }
  document.getElementById('full-chat-title').textContent='Чат: '+(document.getElementById('chat-title').textContent);
  document.getElementById('full-chat-panel').classList.add('show');
  document.getElementById('full-chat-panel').style.display='flex';
  loadFullChatMessages();
}
function closeFullChat() {
  document.getElementById('full-chat-panel').classList.remove('show');
  setTimeout(()=>{ document.getElementById('full-chat-panel').style.display='none'; },300);
}
async function loadFullChatMessages() {
  const container=document.getElementById('full-chat-messages');
  container.innerHTML='';
  const msgs=await db.collection('chats').doc(currentChatId).collection('messages')
    .orderBy('createdAt','asc').get();
  msgs.forEach(doc => {
    const msg=doc.data();
    const div=document.createElement('div');
    div.className='message ' + (msg.senderId===currentUser.uid?'sent':'recv');
    if (msg.replyToId) {
      const reply=document.createElement('div');
      reply.className='reply-preview';
      reply.textContent='Цитата: '+(msg.replyToText||'');
      div.appendChild(reply);
    }
    if (msg.text) {
      const t=document.createElement('div');
      t.textContent=decodeText(msg.text);
      div.appendChild(t);
    }
    if (msg.fileUrl) {
      const a=document.createElement('a');
      a.href=msg.fileUrl; a.target='_blank'; a.textContent='Файл';
      div.appendChild(a);
    }
    const time=document.createElement('div');
    time.className='time';
    const date=new Date((msg.createdAt?.seconds||Date.now()/1000)*1000);
    time.textContent= date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    div.appendChild(time);
    container.appendChild(div);
  });
  container.scrollTop=container.scrollHeight;
}

// Отправка в полноэкранный чат
function sendFullMessage() {
  const msg=document.getElementById('full-chat-message').value.trim();
  if (!msg || !currentChatId) return;
  const encoded=encodeText(msg);
  db.collection('chats').doc(currentChatId).collection('messages').add({
    text:encoded,
    senderId: currentUser.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  document.getElementById('full-chat-message').value='';
}

// Обработка контекстного меню
function showMessageContextMenu(x,y,msgId,msgData) {
  const menu=document.getElementById('context-menu');
  menu.innerHTML='';
  menu.style.left=x+'px'; menu.style.top=y+'px'; menu.style.display='block';

  const btnDel=document.createElement('div');
  btnDel.className='ctx-item'; btnDel.innerHTML='Удалить'; btnDel.onclick=()=>{ deleteMessage(msgId); hideContextMenu(); };
  const btnEdit=document.createElement('div');
  btnEdit.className='ctx-item'; btnEdit.innerHTML='Редактировать'; btnEdit.onclick=()=>{ if (msgData.senderId!==currentUser.uid) { alert('Недоступно'); return; } editMessage(msgId, msgData.text); hideContextMenu(); };
  const btnReport=document.createElement('div');
  btnReport.className='ctx-item'; btnReport.innerHTML='Пожаловаться'; btnReport.onclick=()=>{ showReportForm(msgId); hideContextMenu(); };
  const btnViewProfile=document.createElement('div');
  btnViewProfile.className='ctx-item'; btnViewProfile.innerHTML='Профиль'; btnViewProfile.onclick=()=>{ viewUserProfile(msgData.senderId); hideContextMenu(); };
  const btnViewChat=document.createElement('div');
  btnViewChat.className='ctx-item'; btnViewChat.innerHTML='Инфо о чате'; btnViewChat.onclick=()=>{ viewChatInfo(currentChatId); hideContextMenu(); };
  if (currentUser && currentUser.email==='mcarenko.artem.2012@gmail.com') {
    const devBadge=document.createElement('div');
    devBadge.className='ctx-item'; devBadge.innerHTML='🧑‍💻 Официальный аккаунт';
    devBadge.style.fontWeight='bold'; devBadge.style.background='#3b82f6'; devBadge.style.color='#fff';
    devBadge.onclick=()=>{ alert('Это официальный аккаунт разработчика'); hideContextMenu(); };
    menu.appendChild(devBadge);
  }

  menu.appendChild(btnDel);
  menu.appendChild(btnEdit);
  menu.appendChild(btnReport);
  menu.appendChild(btnViewProfile);
  menu.appendChild(btnViewChat);
}
function hideContextMenu() {
  document.getElementById('context-menu').style.display='none';
}

// Удаление и редактирование
async function deleteMessage(msgId) {
  if (!currentChatId || !msgId) return;
  await db.collection('chats').doc(currentChatId).collection('messages').doc(msgId).delete();
}
async function editMessage(msgId, currentText) {
  const newText=prompt('Редактировать сообщение', decodeText(currentText));
  if (newText===null) return;
  await db.collection('chats').doc(currentChatId).collection('messages').doc(msgId).update({ text: encodeText(newText) });
}

// Жалоба
function showReportForm(msgId) {
  document.getElementById('report-form').dataset.msgId=msgId;
  document.getElementById('report-reason').value='spam';
  document.getElementById('report-description').value='';
  document.getElementById('report-form').style.display='flex';
}
function closeReport() { document.getElementById('report-form').style.display='none'; }
async function submitReport() {
  const msgId= document.getElementById('report-form').dataset.msgId;
  const reason= document.getElementById('report-reason').value;
  const description= document.getElementById('report-description').value;
  if (!msgId) return;
  await db.collection('reports').add({
    messageId: msgId,
    chatId: currentChatId,
    reporterId: currentUser.uid,
    reason,
    description,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  alert('Жалоба отправлена');
  closeReport();
}

// Вспомогательные функции
function viewUserProfile(userId) {
  alert('Профиль пользователя: '+userId);
}
function viewChatInfo(chatId) {
  alert('Информация о чате: '+chatId);
}
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('hidden');
}
function showProfile() {
  if (!currentUser) { alert('Не авторизованы'); return; }
  db.collection('users').doc(currentUser.uid).get().then(doc => {
    if (doc.exists) {
      const data=doc.data();
      document.getElementById('profile-img').value=data.avatarUrl||'';
      document.getElementById('profile-name').value=data.name||'';
      document.getElementById('profile-username').value=data.username||'';
      document.getElementById('profile-status').value=data.status||'';
    }
    document.getElementById('profile-panel').classList.add('show');
    document.getElementById('profile-panel').style.display='flex';
  });
}
function closeProfile() {
  document.getElementById('profile-panel').classList.remove('show');
  setTimeout(()=>{ document.getElementById('profile-panel').style.display='none'; },300);
}
async function saveProfile() {
  const name=document.getElementById('profile-name').value.trim();
  const username=document.getElementById('profile-username').value.trim();
  const avatarUrl=document.getElementById('profile-avatar').value.trim();
  if (!name || !username) { alert('Заполните имя и username'); return; }
  await db.collection('users').doc(currentUser.uid).set({ name, username, avatarUrl }, { merge:true });
  closeProfile();
  await loadChats();
}
function openExtendedChat() {
  document.getElementById('extended-chat-creation').classList.add('show');
  document.getElementById('extended-chat-creation').style.display='flex';
}
function closeExtendedChat() {
  document.getElementById('extended-chat-creation').classList.remove('show');
  setTimeout(()=>{ document.getElementById('extended-chat-creation').style.display='none'; },300);
}
async function createExtendedChat() {
  const name=document.getElementById('ext-chat-name').value.trim();
  const membersStr=document.getElementById('ext-chat-members').value.trim();
  if (!name || !membersStr) { alert('Заполните название и участников'); return; }
  const members=membersStr.split(',').map(s=>s.trim()).filter(s=>s);
  if (!members.includes(currentUser.email)) members.push(currentUser.email);
  await db.collection('chats').add({ name, members, createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  closeExtendedChat();
  await loadChats();
}
function toggleSearchResults() {
  document.getElementById('search-panel').classList.toggle('active');
}
function searchEntities() {
  // Реализуйте поиск по юзернеймам или названиям чатам
}

// Отправка сообщений
async function sendMessage() {
  const text=document.getElementById('message-input').value.trim();
  const fileInput=document.getElementById('file-input');
  if (!currentChatId) { alert('Выберите чат'); return; }
  if (!text && fileInput.files.length===0) { alert('Пожалуйста, введите сообщение или прикрепите файл'); return; }

  let fileUrl='';
  if (fileInput.files.length>0) {
    const file=fileInput.files[0];
    const ref=storage.ref().child('files/'+Date.now()+'_'+file.name);
    await ref.put(file);
    fileUrl= await ref.getDownloadURL();
  }

  const encodedText=text?encodeText(text):null;
  await db.collection('chats').doc(currentChatId).collection('messages').add({
    text: encodedText,
    fileUrl,
    senderId: currentUser.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    replyToId: replyToMessageId,
    replyToText: replyToMessageId ? (document.querySelector(`[data-id="${replyToMessageId}"]`)?.textContent || '') : null
  });
  document.getElementById('message-input').value='';
  document.getElementById('file-input').value='';
  replyToMessageId=null;
}

// Отправка сообщения из полноэкранного чата
function sendFullMessage() {
  const msg=document.getElementById('full-chat-message').value.trim();
  if (!msg || !currentChatId) return;
  const encoded=encodeText(msg);
  db.collection('chats').doc(currentChatId).collection('messages').add({
    text:encoded,
    senderId: currentUser.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  document.getElementById('full-chat-message').value='';
}

// Контекстное меню
function showMessageContextMenu(x,y,msgId,msgData) {
  const menu=document.getElementById('context-menu');
  menu.innerHTML='';
  menu.style.left=x+'px'; menu.style.top=y+'px'; menu.style.display='block';

  const btnDel=document.createElement('div');
  btnDel.className='ctx-item'; btnDel.innerHTML='Удалить'; btnDel.onclick=()=>{ deleteMessage(msgId); hideContextMenu(); };
  const btnEdit=document.createElement('div');
  btnEdit.className='ctx-item'; btnEdit.innerHTML='Редактировать'; btnEdit.onclick=()=>{ if (msgData.senderId!==currentUser.uid) { alert('Недоступно'); return; } editMessage(msgId, msgData.text); hideContextMenu(); };
  const btnReport=document.createElement('div');
  btnReport.className='ctx-item'; btnReport.innerHTML='Пожаловаться'; btnReport.onclick=()=>{ showReportForm(msgId); hideContextMenu(); };
  const btnViewProfile=document.createElement('div');
  btnViewProfile.className='ctx-item'; btnViewProfile.innerHTML='Профиль'; btnViewProfile.onclick=()=>{ viewUserProfile(msgData.senderId); hideContextMenu(); };
  const btnViewChat=document.createElement('div');
  btnViewChat.className='ctx-item'; btnViewChat.innerHTML='Инфо о чате'; btnViewChat.onclick=()=>{ viewChatInfo(currentChatId); hideContextMenu(); };
  if (currentUser && currentUser.email==='mcarenko.artem.2012@gmail.com') {
    const devBadge=document.createElement('div');
    devBadge.className='ctx-item'; devBadge.innerHTML='🧑‍💻 Официальный аккаунт';
    devBadge.style.fontWeight='bold'; devBadge.style.background='#3b82f6'; devBadge.style.color='#fff';
    devBadge.onclick=()=>{ alert('Это официальный аккаунт разработчика'); hideContextMenu(); };
    menu.appendChild(devBadge);
  }

  menu.appendChild(btnDel);
  menu.appendChild(btnEdit);
  menu.appendChild(btnReport);
  menu.appendChild(btnViewProfile);
  menu.appendChild(btnViewChat);
}
function hideContextMenu() {
  document.getElementById('context-menu').style.display='none';
}

// Обработка клавиш
document.addEventListener('click', ()=>{ hideContextMenu(); });

// Основные функции вызова
// В обработчиках кнопок вызывайте соответствующие функции
</script>