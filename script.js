// 1. КОНФИГУРАЦИЯ FIREBASE (Storage удален)
const firebaseConfig = {
    apiKey: "AIzaSyD6JQPUxDIgoKoYKRdlx20UAo7RjHQSzro",
    authDomain: "burhlin--gnomes-database.firebaseapp.com",
    projectId: "burhlin--gnomes-database",
    messagingSenderId: "184546558617",
    appId: "1:184546558617:web:455f2a7a8d7215ec486e08",
    measurementId: "G-Q6QWS27Y1Z"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUserData = null;
let currentAuthMode = 'login';

// ================= UI Логика =================
function openAuthModal(mode) {
    document.getElementById('auth-modal').style.display = 'block';
    currentAuthMode = mode;
    const isLogin = mode === 'login';
    document.getElementById('auth-title').innerText = isLogin ? 'Вход' : 'Регистрация';
    document.getElementById('username').style.display = isLogin ? 'none' : 'block';
    document.getElementById('auth-action-btn').innerText = isLogin ? 'Войти' : 'Зарегистрироваться';
    document.getElementById('auth-switch-text').innerText = isLogin ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти';
    document.getElementById('auth-action-btn').onclick = isLogin ? login : register;
}

function toggleAuthMode() {
    openAuthModal(currentAuthMode === 'login' ? 'register' : 'login');
}

function openUploadModal() { document.getElementById('upload-modal').style.display = 'block'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// ================= Авторизация =================
async function register() {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    const user = document.getElementById('username').value;
    if (!user) return alert("Введи никнейм!");

    try {
        const cred = await auth.createUserWithEmailAndPassword(email, pass);
        await db.collection('users').doc(cred.user.uid).set({
            username: user,
            role: (user === 'Antropomeda') ? 'admin' : 'player'
        });
        closeModal('auth-modal');
    } catch (err) { alert(err.message); }
}

async function login() {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    try {
        await auth.signInWithEmailAndPassword(email, pass);
        closeModal('auth-modal');
    } catch (err) { alert(err.message); }
}

function logout() { auth.signOut(); }

auth.onAuthStateChanged(async (user) => {
    if (user) {
        document.getElementById('auth-buttons').style.display = 'none';
        document.getElementById('user-info').style.display = 'flex';
        
        const doc = await db.collection('users').doc(user.uid).get();
        if (doc.exists) {
            currentUserData = doc.data();
            currentUserData.uid = user.uid;
            document.getElementById('user-greeting').innerText = `Привет, ${currentUserData.username}!`;
            if (currentUserData.role === 'admin') {
                document.getElementById('admin-panel').style.display = 'block';
            }
        }
    } else {
        currentUserData = null;
        document.getElementById('auth-buttons').style.display = 'flex';
        document.getElementById('user-info').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'none';
    }
    loadMaps();
});

// ================= База Данных Карт =================
async function loadMaps() {
    document.getElementById('loading-spinner').style.display = 'block';
    const grid = document.getElementById('maps-grid');
    grid.innerHTML = '';

    const sortType = document.getElementById('sortSelect').value;
    const modeType = document.getElementById('modeSelect').value;

    let query = db.collection('maps');
    if (sortType === 'newest') query = query.orderBy('CreatedAt', 'desc');
    else if (sortType === 'downloads') query = query.orderBy('Downloads', 'desc');
    else if (sortType === 'likes') query = query.orderBy('Likes', 'desc');

    try {
        const snapshot = await query.get();
        document.getElementById('loading-spinner').style.display = 'none';
        
        if (snapshot.empty) {
            grid.innerHTML = '<p class="loading">Карт пока нет.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const map = doc.data();
            map.id = doc.id;
            if (modeType !== 'all' && map.TargetMode !== modeType) return;
            grid.appendChild(createMapCard(map));
        });
        filterMaps();
    } catch (err) {
        console.error(err);
        document.getElementById('loading-spinner').innerText = "Ошибка загрузки базы данных.";
    }
}

function createMapCard(map) {
    const div = document.createElement('div');
    div.className = 'map-card';
    
    // Если картинки нет, ставим заглушку
    const imgUrl = map.ImageBase64 || 'https://via.placeholder.com/300x180?text=Нет+Изображения';
    const canDelete = currentUserData && (currentUserData.role === 'admin' || currentUserData.username === map.Author);
    const likedPlayers = map.LikedPlayers || [];
    const hasLiked = currentUserData && likedPlayers.includes(currentUserData.uid);
    const likeColor = hasLiked ? 'var(--danger)' : 'white';

    div.innerHTML = `
        <img src="${imgUrl}" class="map-img" alt="Map">
        <div class="map-info">
            <h3 class="map-title">${map.Name} <span style="font-size:12px;color:gray">v${map.Version || '1.0'}</span></h3>
            <p class="map-author"><i class="fa-solid fa-user"></i> ${map.Author} | <i class="fa-solid fa-gamepad"></i> ${map.TargetMode}</p>
            <p class="map-desc">${map.Description || 'Без описания.'}</p>
            <div class="map-stats">
                <span><i class="fa-solid fa-heart"></i> ${map.Likes || 0}</span>
                <span><i class="fa-solid fa-download"></i> ${map.Downloads || 0}</span>
            </div>
            <div class="map-actions">
                <button class="btn btn-primary" onclick="downloadMap('${map.id}', '${map.Name}')"><i class="fa-solid fa-download"></i> Скачать</button>
                <button class="btn btn-outline" style="color:${likeColor}; border-color:${likeColor}" onclick="likeMap('${map.id}')">
                    <i class="fa-solid fa-heart"></i>
                </button>
                ${canDelete ? `<button class="btn btn-danger" onclick="deleteMap('${map.id}')"><i class="fa-solid fa-trash"></i></button>` : ''}
            </div>
        </div>
    `;
    return div;
}

function filterMaps() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const cards = document.querySelectorAll('.map-card');
    cards.forEach(card => {
        const title = card.querySelector('.map-title').innerText.toLowerCase();
        card.style.display = title.includes(search) ? 'block' : 'none';
    });
}

// ================= ФУНКЦИЯ СЖАТИЯ КАРТИНКИ =================
// Сжимает картинку, чтобы она поместилась в бесплатный Firestore
function resizeImageToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 600; // Ужимаем до 600 пикселей (достаточно для карточки)
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                // Качество 0.7 (сильно снизит вес, но будет выглядеть нормально)
                resolve(canvas.toDataURL('image/jpeg', 0.7)); 
            };
        };
        reader.onerror = error => reject(error);
    });
}

// ================= ЗАГРУЗКА КАРТЫ (БЕЗ STORAGE) =================
async function uploadMap() {
    if (!currentUserData) return alert("Нужно войти в систему!");
    
    const name = document.getElementById('map-name').value.trim();
    const desc = document.getElementById('map-desc').value;
    const mode = document.getElementById('map-mode').value;
    const txtFile = document.getElementById('map-file').files[0];
    const imgFile = document.getElementById('map-img').files[0];

    if (!name || !txtFile) return alert("Название и файл карты обязательны!");

    const btn = document.getElementById('upload-btn');
    btn.innerText = "Загрузка...";
    btn.disabled = true;

    try {
        // Читаем TXT файл как обычный текст
        const mapContent = await txtFile.text();

        // Сжимаем картинку, если она есть
        let imageBase64 = "";
        if (imgFile) {
            imageBase64 = await resizeImageToBase64(imgFile);
        }

        // Сохраняем всё как ТЕКСТ прямо в Firestore
        await db.collection('maps').doc(name).set({
            Name: name,
            Description: desc,
            Author: currentUserData.username,
            TargetMode: mode,
            Version: "1.0.0",
            MapDataContent: mapContent, // Храним код карты тут
            ImageBase64: imageBase64,   // Храним картинку тут
            Likes: 0,
            Downloads: 0,
            LikedPlayers: [],
            CreatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("Карта успешно опубликована!");
        closeModal('upload-modal');
        loadMaps();
    } catch (err) {
        console.error(err);
        alert("Ошибка загрузки: " + err.message);
    } finally {
        btn.innerText = "Опубликовать";
        btn.disabled = false;
    }
}

// ================= СКАЧИВАНИЕ КАРТЫ (СБОРКА НА ЛЕТУ) =================
async function downloadMap(mapId, mapName) {
    try {
        // Получаем документ из базы
        const doc = await db.collection('maps').doc(mapId).get();
        if (!doc.exists) return alert("Карта удалена!");

        const mapData = doc.data().MapDataContent;
        if (!mapData) return alert("Файл карты пуст!");

        // Создаем текстовый файл в памяти браузера
        const blob = new Blob([mapData], { type: "text/plain" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = mapName + ".txt"; // Имя для сохранения
        
        // Автоматически нажимаем на скрытую ссылку
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Увеличиваем счетчик
        await db.collection('maps').doc(mapId).update({
            Downloads: firebase.firestore.FieldValue.increment(1)
        });
        loadMaps();

    } catch(e) {
        alert("Ошибка скачивания: " + e.message);
    }
}

async function likeMap(mapId) {
    if (!currentUserData) return alert("Войдите, чтобы ставить лайки!");
    
    const mapRef = db.collection('maps').doc(mapId);
    const doc = await mapRef.get();
    let likedPlayers = doc.data().LikedPlayers || [];
    
    if (likedPlayers.includes(currentUserData.uid)) {
        likedPlayers = likedPlayers.filter(id => id !== currentUserData.uid);
        await mapRef.update({ Likes: firebase.firestore.FieldValue.increment(-1), LikedPlayers: likedPlayers });
    } else {
        likedPlayers.push(currentUserData.uid);
        await mapRef.update({ Likes: firebase.firestore.FieldValue.increment(1), LikedPlayers: likedPlayers });
    }
    loadMaps();
}

async function deleteMap(mapId) {
    if(confirm("Точно удалить карту?")) {
        await db.collection('maps').doc(mapId).delete();
        loadMaps();
    }
}

// Запуск
loadMaps();
