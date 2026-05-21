# Spécification Technique : Application de Suivi de Prix Crypto & Alertes (Stack MERN - SSE)

Ce document décrit l'architecture, la structure des données et la logique d'implémentation pour l'application web de suivi du cours Bitcoin/USDT en temps réel et de simulation d'alertes de prix.

---

## 🎯 1. Description du Projet

L'application est un tableau de bord web moderne et réactif. Elle se connecte à l'API publique de Binance côté serveur, enregistre le cours en arrière-plan dans MongoDB, et utilise **Server-Sent Events (SSE)** pour diffuser les variations de prix et les alertes déclenchées en temps réel aux clients connectés.

### Fonctionnalités Clés :
1. **Suivi Temps Réel** : Affichage dynamique du cours du BTC/USDT (mise à jour toutes les 5 secondes) avec animations visuelles de hausse/baisse.
2. **Graphique Intraday Interactif** : Graphique linéaire fluide affichant les variations récentes (généré en SVG natif côté client pour une légèreté et une personnalisation esthétique maximale).
3. **Formulaire de Gestion d'Alertes** : Définition d'alertes (Supérieur à `>` ou Inférieur à `<`) avec persistance dans MongoDB via Mongoose.
4. **Moteur d'Évaluation d'Alertes** : Évaluation automatique à chaque polling Binance.
5. **Notifications Push Toast** : Affichage de toast notifications animées et élégantes dans le navigateur à la seconde où une alerte se déclenche.
6. **Design Premium & Responsive** : Interface sombre (Dark Mode) immersive avec une expérience utilisateur optimale sur mobile, tablette et ordinateur de bureau.

---

## 📁 2. Structure des Dossiers du Projet

```text
crypto-app/
├── src/
│   ├── config/
│   │   └── db.js              # Connexion MongoDB / Mongoose
│   ├── models/
│   │   ├── Alert.js           # Schéma Mongoose pour les alertes
│   │   └── PriceHistory.js    # Schéma Mongoose pour l'historique des prix
│   ├── routes/
│   │   ├── alertRoutes.js     # Routes de l'API Alertes (CRUD)
│   │   └── priceRoutes.js     # Routes de l'API Prix (SSE & historique)
│   ├── controllers/
│   │   ├── alertController.js # Contrôleurs pour les alertes
│   │   └── priceController.js # Contrôleurs pour les prix et le flux SSE
│   ├── services/
│   │   ├── binanceService.js  # Polling Binance API + Moteur d'évaluation des alertes
│   │   └── sseService.js      # Gestionnaire de connexions Server-Sent Events
│   ├── public/
│   │   ├── index.html         # Template HTML5 sémantique principal
│   │   ├── css/
│   │   │   └── style.css      # CSS Premium Responsive (Variables, Flexbox, Animations)
│   │   └── js/
│   │       └── app.js         # Logique Frontend (Graphique SVG, Formulaires, Toast notifications)
│   └── server.js              # Initialisation du serveur Express
├── .env                       # Fichier de configuration d'environnement (variables d'environnement)
├── .gitignore                 # Fichier d'exclusion Git (.env, node_modules, .superpowers)
└── package.json               # Dépendances du projet
```

---

## 💾 3. Modèles de Données (Mongoose)

### A. Modèle d'Alerte (`Alert.js`)
Stocker les configurations d'alertes entrées par l'utilisateur.

```javascript
const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  targetPrice: {
    type: Number,
    required: true,
    min: [0, 'Le prix cible doit être supérieur ou égal à 0']
  },
  type: {
    type: String,
    enum: {
      values: ['above', 'below'],
      message: 'Le type doit être "above" (supérieur à) ou "below" (inférieur à)'
    },
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'triggered'],
    default: 'active'
  },
  triggeredAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Alert', alertSchema);
```

### B. Modèle d'Historique de Prix (`PriceHistory.js`)
Stocker l'historique récent du cours du BTC. Un index TTL de 24h est configuré pour nettoyer automatiquement les données anciennes.

```javascript
const mongoose = require('mongoose');

const priceHistorySchema = new mongoose.Schema({
  price: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: { expires: '24h' } // MongoDB nettoie automatiquement les données de plus de 24 heures !
  }
});

module.exports = mongoose.model('PriceHistory', priceHistorySchema);
```

---

## ⚙️ 4. Logique du Backend (Services & Contrôleurs)

### A. Service de Polling et de Déclenchement (`binanceService.js`)
Ce service s'exécute en arrière-plan à l'aide d'un intervalle récurrent.

```javascript
// Pseudo-code de la logique d'arrière-plan
async function pollBinancePrice() {
  try {
    const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
    const data = await response.json();
    const currentPrice = parseFloat(data.price);
    
    // 1. Sauvegarder dans l'historique
    const priceRecord = await PriceHistory.create({ price: currentPrice });
    
    // 2. Diffuser le prix actuel aux clients SSE
    sseService.broadcast('priceUpdate', { price: currentPrice, timestamp: priceRecord.timestamp });
    
    // 3. Évaluer les alertes actives
    const activeAlerts = await Alert.find({ status: 'active' });
    for (const alert of activeAlerts) {
      let isTriggered = false;
      if (alert.type === 'above' && currentPrice >= alert.targetPrice) {
        isTriggered = true;
      } else if (alert.type === 'below' && currentPrice <= alert.targetPrice) {
        isTriggered = true;
      }
      
      if (isTriggered) {
        alert.status = 'triggered';
        alert.triggeredAt = new Date();
        await alert.save();
        
        // Diffuser immédiatement l'alerte déclenchée
        sseService.broadcast('alertTriggered', alert);
      }
    }
  } catch (error) {
    console.error('Erreur lors du polling Binance API:', error);
  }
}
```

### B. Gestionnaire Server-Sent Events (`sseService.js`)
```javascript
let clients = [];

function registerClient(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache'
  });
  
  // Envoyer un commentaire pour valider la connexion initiale
  res.write(': connected\n\n');
  
  clients.push(res);
  
  req.on('close', () => {
    clients = clients.filter(c => c !== res);
  });
}

function broadcast(event, data) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach(res => res.write(message));
}
```

### C. Routes d'API
- `GET /api/price/history` : Renvoie les 100 derniers points de prix enregistrés pour le graphique initial.
- `GET /api/price/stream` : Point de connexion SSE pour écouter en temps réel.
- `GET /api/alerts` : Renvoie toutes les alertes (actives et déclenchées).
- `POST /api/alerts` : Ajoute une nouvelle alerte de prix.
- `DELETE /api/alerts/:id` : Supprime une alerte.

---

## 🎨 5. Design Frontend & Expérience Utilisateur (UI/UX)

L'interface utilisateur se compose d'une seule page Web (Single Page App) hautement optimisée, performante et sans dépendance lourde, pour garantir des performances de chargement instantanées et une flexibilité maximale.

### A. Palette de Couleurs (Thème Sombre Moderne) :
- **Arrière-plan principal** : HSL(240, 10%, 4%) — Noir de jais profond et reposant.
- **Cartes & Conteneurs** : HSL(240, 6%, 10%) — Gris de zinc anthracite avec bordures fines.
- **Accents & Bordures** : HSL(240, 5%, 18%) / HSL(240, 5%, 84%).
- **Vert Fluide (Hausse / Succès)** : HSL(142, 70%, 45%) — Vert émeraude vibrant.
- **Rouge Fluide (Baisse / Alerte)** : HSL(0, 84%, 60%) — Rouge corail vif.
- **Violet Électrique (Alerte Active / Actions)** : HSL(263, 80%, 58%).

### B. Composants UI :
1. **Header Premium** : Logo moderne, indicateur de statut de la connexion en direct (point vert pulsant ou jaune de déconnexion).
2. **Hero Section (Prix du BTC)** :
   - Affichage géant du prix du Bitcoin en dollars (USDT).
   - Indicateur de tendance (+/- % et mini-flèche directionnelle).
   - Micro-animations de pulse (lueur verte lors d'une hausse, lueur rouge lors d'une baisse) qui durent 1 seconde à chaque actualisation.
3. **Graphique Interactif SVG** :
   - Graphique linéaire utilisant l'élément `<svg>` natif.
   - Les points du tracé se mettent à jour de manière fluide sans rechargement.
   - Dégradé linéaire d'ombrage sous la courbe du prix pour un rendu premium moderne.
4. **Formulaire d'Alertes** :
   - Sélections de type d'alertes via des boutons stylisés (Above `>` / Below `<`).
   - Champ de saisie numérique stylisé pour le prix cible.
   - Bouton de soumission avec micro-animations de survol et état de chargement.
5. **Gestionnaire d'Alertes** :
   - Deux listes séparées : "Alertes Actives" et "Alertes Déclenchées".
   - Les alertes affichent leur prix cible, le type et un indicateur visuel de statut.
   - Bouton de suppression rapide avec animation de survol.
6. **Notifications Toast** :
   - Popups de notification éphémères en haut à droite de l'écran lors du déclenchement d'une alerte.
   - Animation d'entrée fluide (slide-in) et de sortie progressive (fade-out).
   - Effet sonore discret facultatif (synthèse d'un bip harmonieux par l'API Web Audio native du navigateur).

---

## 🧪 6. Plan de Vérification

### Tests Automatisés & Manuels :
1. **Validation de la connexion DB** : Vérifier que Mongoose se connecte proprement et gère les erreurs de reconnexion.
2. **Test du flux SSE** : Ouvrir deux navigateurs différents et vérifier que le prix change sur les deux écrans au même instant.
3. **Déclenchement des alertes** :
   - Créer une alerte très proche du prix du marché actuel.
   - Vérifier dans les logs et à l'écran qu'elle passe au statut `'triggered'` dès que le cours l'atteint.
   - Valider l'affichage instantané de la notification Toast.
4. **Vérification Responsiveness** : Utiliser les outils de développement (Device Emulation) pour tester sur iPhone, iPad et moniteur 4K afin de s'assurer qu'aucun élément ne déborde et que la lisibilité reste irréprochable.
