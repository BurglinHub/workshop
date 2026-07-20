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
let dynamicModes = ['Sandbox', 'Race']; // Дефолтные режимы

// ================= DYNAMIC MODES (API) =================
// Читаем список режимов из базы. Твой мод сможет добавлять сюда новые!
async function loadGameModes() {
    try {
        const doc = await db.collection('settings').doc('modes').get();
        if (doc.exists && doc.data().modeList) {
            dynamicModes = doc.data().modeList;
        } else {
            // Если документа нет, создаем его с дефолтными значениями
            await db.collection('settings').doc('modes').set({ modeList: dynamicModes });
        }
        
        const filterSelect = document.getElementById('modeSelect');
        const uploadSelect = document.getElementById('map-mode');
        
        // Очищаем и заполняем
        filterSelect.innerHTML = '<option value="all">All Modes</option>';
        uploadSelect.innerHTML = '';
        
        dynamicModes.forEach(mode => {
            filterSelect.innerHTML += `<option value="${mode}">${mode}</option>`;
            uploadSelect.innerHTML += `<option value="${mode}">${mode}</option>`;
        });
    } catch (err) {
        console.error("Failed to load game modes:", err);
    }
}

// ================= UI & MODALS =================
function openAuthModal(mode) {
    document.getElementById('auth-modal').style.display = 'block';
    currentAuthMode = mode;
    const isLogin = mode === 'login';
    document.getElementById('auth-title').innerText = isLogin ? 'Login' : 'Register';
    document.getElementById('username').style.display = isLogin ? 'none' : 'block';
    document.getElementById('auth-action-btn').innerText = isLogin ? 'Login' : 'Create Account';
    document.getElementById('auth-switch-text').innerText = isLogin ? "Don't have an account? Register" : 'Already have an account? Login';
    document.getElementById('auth-action-btn').onclick = isLogin ? login : register;
}

function toggleAuthMode() { openAuthModal(currentAuthMode === 'login' ? 'register' : 'login'); }
function openUploadModal() { document.getElementById('upload-modal').style.display = 'block'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// ================= AUTHENTICATION =================
async function register() {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    const user = document.getElementById('username').value;
    if (!user) return alert("Please enter a username!");

    try {
        const cred = await auth.createUserWithEmailAndPassword(email, pass);
        // Записываем данные в Firestore
        await db.collection('users').doc(cred.user.uid).set({
            username: user,
            role: 'player' // Защита на сервере не даст поставить admin
        });
        closeModal('auth-modal');
    } catch (err) { alert("Registration Error: " + err.message); }
}

async function login() {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    try {
        await auth.signInWithEmailAndPassword(email, pass);
        closeModal('auth-modal');
    } catch (err) { alert("Login Error: " + err.message); }
}

function logout() { auth.signOut(); }

// ИСПРАВЛЕННЫЙ БАГ ИНТЕРФЕЙСА
auth.onAuthStateChanged(async (user) => {
    if (user) {
        try {
            const doc = await db.collection('users').doc(user.uid).get();
            if (doc.exists) {
                currentUserData = doc.data();
                currentUserData.uid = user.uid;
            } else {
                // Если произошел сбой и документа нет, создаем "заглушку"
                currentUserData = { username: user.email.split('@')[0], role: 'player', uid: user.uid };
            }
            
            document.getElementById('auth-buttons').style.display = 'none';
            document.getElementById('user-info').style.display = 'flex';
            document.getElementById('user-greeting').innerText = `Hello, ${currentUserData.username}!`;
            
            if (currentUserData.role === 'admin') {
                document.getElementById('admin-panel').style.display = 'block';
            }
        } catch (e) { console.error("Error fetching user data:", e); }
    } else {
        currentUserData = null;
        document.getElementById('auth-buttons').style.display = 'flex';
        document.getElementById('user-info').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'none';
    }
    loadMaps();
});

// ================= MAP DATABASE =================
function escapeHTML(str) {
    if (!str) return "";
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag]));
}

async function loadMaps() {
    document.getElementById('loading-spinner').style.display = 'block';
    document.getElementById('empty-state').style.display = 'none';
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
        
        let loadedCount = 0;

        snapshot.forEach(doc => {
            const map = doc.data();
            map.id = doc.id;
            if (modeType !== 'all' && map.TargetMode !== modeType) return;
            
            grid.appendChild(createMapCard(map));
            loadedCount++;
        });

        if (loadedCount === 0) {
            document.getElementById('empty-state').style.display = 'block';
        }

        filterMaps();
    } catch (err) {
        console.error(err);
        document.getElementById('loading-spinner').innerHTML = "<span style='color:red'>Database error. Please try again.</span>";
    }
}

function createMapCard(map) {
    const div = document.createElement('div');
    div.className = 'map-card';
    
    const imgUrl = map.ImageBase64 || 'https://via.placeholder.com/400x200/1c1c24/00e5ff?text=No+Preview';
    const canDelete = currentUserData && (currentUserData.role === 'admin' || currentUserData.username === map.Author);
    const likedPlayers = map.LikedPlayers || [];
    const hasLiked = currentUserData && likedPlayers.includes(currentUserData.uid);
    const likeColor = hasLiked ? 'var(--danger)' : 'white';

    const safeName = escapeHTML(map.Name);
    const safeAuthor = escapeHTML(map.Author);
    const safeDesc = escapeHTML(map.Description);

    div.innerHTML = `
        <div class="mode-badge">${escapeHTML(map.TargetMode)}</div>
        <img src="${imgUrl}" class="map-img" alt="Map">
        <div class="map-info">
            <h3 class="map-title">${safeName}</h3>
            <p class="map-author">By <b>${safeAuthor}</b> | v${escapeHTML(map.Version || '1.0')}</p>
            <p class="map-desc">${safeDesc || 'No description provided.'}</p>
            <div class="map-stats">
                <span><i class="fa-solid fa-heart" style="color:var(--danger)"></i> ${map.Likes || 0}</span>
                <span><i class="fa-solid fa-download" style="color:var(--primary)"></i> ${map.Downloads || 0}</span>
            </div>
            <div class="map-actions">
                <button class="btn btn-primary" onclick="downloadMap('${map.id}', '${safeName}')"><i class="fa-solid fa-download"></i></button>
                <button class="btn btn-outline" style="color:${likeColor}; border-color:${likeColor}" onclick="likeMap('${map.id}')"><i class="fa-solid fa-heart"></i></button>
                ${canDelete ? `<button class="btn btn-danger" onclick="deleteMap('${map.id}')"><i class="fa-solid fa-trash"></i></button>` : ''}
            </div>
        </div>
    `;
    return div;
}

function filterMaps() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const cards = document.querySelectorAll('.map-card');
    let visibleCount = 0;

    cards.forEach(card => {
        const title = card.querySelector('.map-title').innerText.toLowerCase();
        if (title.includes(search)) {
            card.style.display = 'flex';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    document.getElementById('empty-state').style.display = (visibleCount === 0) ? 'block' : 'none';
}

function resizeImageToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 600;
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.7)); 
            };
        };
        reader.onerror = error => reject(error);
    });
}

async function uploadMap() {
    if (!currentUserData) return alert("You must be logged in to upload!");
    
    const name = document.getElementById('map-name').value.trim();
    const desc = document.getElementById('map-desc').value;
    const mode = document.getElementById('map-mode').value;
    const txtFile = document.getElementById('map-file').files[0];
    const imgFile = document.getElementById('map-img').files[0];

    if (!name || !txtFile) return alert("Map name and .txt file are required!");

    const btn = document.getElementById('upload-btn');
    btn.innerText = "Uploading...";
    btn.disabled = true;

    try {
        const mapContent = await txtFile.text();
        let imageBase64 = "";
        if (imgFile) imageBase64 = await resizeImageToBase64(imgFile);

        await db.collection('maps').doc(name).set({
            Name: name,
            Description: desc,
            Author: currentUserData.username,
            TargetMode: mode,
            Version: "1.0.0",
            MapDataContent: mapContent,
            ImageBase64: imageBase64,
            Likes: 0,
            Downloads: 0,
            LikedPlayers: [],
            CreatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("Map published successfully!");
        closeModal('upload-modal');
        loadMaps();
    } catch (err) {
        console.error(err);
        alert("Upload error: " + err.message);
    } finally {
        btn.innerText = "Publish Map";
        btn.disabled = false;
    }
}

async function downloadMap(mapId, mapName) {
    try {
        const doc = await db.collection('maps').doc(mapId).get();
        if (!doc.exists) return alert("Map has been deleted!");

        const mapData = doc.data().MapDataContent;
        if (!mapData) return alert("Map file is empty!");

        const blob = new Blob([mapData], { type: "text/plain" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = mapName + ".txt";
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        await db.collection('maps').doc(mapId).update({
            Downloads: firebase.firestore.FieldValue.increment(1)
        });
        loadMaps();
    } catch(e) { alert("Download error: " + e.message); }
}

async function likeMap(mapId) {
    if (!currentUserData) return alert("Please login to like maps!");
    
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
    if(confirm("Are you sure you want to delete this map?")) {
        await db.collection('maps').doc(mapId).delete();
        loadMaps();
    }
}

// Загружаем режимы перед загрузкой карт
loadGameModes().then(() => {
    loadMaps();
});
