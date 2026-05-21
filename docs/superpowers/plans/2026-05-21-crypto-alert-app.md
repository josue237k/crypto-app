# Suivi de Prix Crypto & Alertes - Plan d'Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire une application Express + Mongoose + SSE ultra-propre et responsive pour suivre le cours du BTC/USDT en temps réel et gérer des alertes de prix.

**Architecture:** Architecture MVC (Model-View-Controller) avec des services découplés pour le polling de l'API Binance et la gestion Server-Sent Events (SSE). Les données de prix utilisent un index TTL pour s'auto-nettoyer après 24 heures.

**Tech Stack:** Node.js, Express, MongoDB, Mongoose, Jest, Supertest, SSE natif, HTML5/CSS3 moderne.

---

### Task 1: Initialisation du Projet & Configuration

**Files:**
- Create: `package.json`
- Create: `.env`
- Create: `.gitignore`
- Create: `src/config/db.js`
- Test: `tests/config/db.test.js`

- [ ] **Step 1: Créer le fichier package.json**
- [ ] **Step 2: Créer le fichier de configuration d'environnement .env**
- [ ] **Step 3: Créer le fichier .gitignore**
- [ ] **Step 4: Créer la configuration de la base de données src/config/db.js**
- [ ] **Step 5: Écrire le test unitaire pour la connexion tests/config/db.test.js**
- [ ] **Step 6: Exécuter le test unitaire de connexion**
- [ ] **Step 7: Commit**

---

### Task 2: Modèles Mongoose (Alert & PriceHistory)

**Files:**
- Create: `src/models/Alert.js`
- Create: `src/models/PriceHistory.js`
- Test: `tests/models/models.test.js`

- [ ] **Step 1: Créer le modèle d'Alerte src/models/Alert.js**
- [ ] **Step 2: Créer le modèle d'Historique de Prix src/models/PriceHistory.js**
- [ ] **Step 3: Écrire les tests unitaires pour les modèles tests/models/models.test.js**
- [ ] **Step 4: Exécuter les tests des modèles**
- [ ] **Step 5: Commit**

---

### Task 3: Le Service Server-Sent Events (sseService)

**Files:**
- Create: `src/services/sseService.js`
- Test: `tests/services/sseService.test.js`

- [ ] **Step 1: Créer src/services/sseService.js**
- [ ] **Step 2: Créer le test unitaire tests/services/sseService.test.js**
- [ ] **Step 3: Exécuter les tests du service SSE**
- [ ] **Step 4: Commit**

---

### Task 4: Le Service Binance & Évaluateur d'Alertes (binanceService)

**Files:**
- Create: `src/services/binanceService.js`
- Test: `tests/services/binanceService.test.js`

- [ ] **Step 1: Créer src/services/binanceService.js**
- [ ] **Step 2: Créer le test unitaire tests/services/binanceService.test.js**
- [ ] **Step 3: Exécuter les tests du service Binance**
- [ ] **Step 4: Commit**

---

### Task 5: Contrôleurs HTTP et Routes API

**Files:**
- Create: `src/controllers/alertController.js`
- Create: `src/controllers/priceController.js`
- Create: `src/routes/alertRoutes.js`
- Create: `src/routes/priceRoutes.js`
- Test: `tests/controllers/api.test.js`

- [ ] **Step 1: Créer le contrôleur des alertes src/controllers/alertController.js**
- [ ] **Step 2: Créer le contrôleur de prix src/controllers/priceController.js**
- [ ] **Step 3: Créer les routes des alertes src/routes/alertRoutes.js**
- [ ] **Step 4: Créer les routes de prix src/routes/priceRoutes.js**
- [ ] **Step 5: Écrire les tests d'intégration d'API tests/controllers/api.test.js**
- [ ] **Step 6: Exécuter les tests d'intégration d'API**
- [ ] **Step 7: Commit**

---

### Task 6: Assemblage du Serveur Express (server.js)

**Files:**
- Create: `src/server.js`

- [ ] **Step 1: Créer le point d'entrée src/server.js**
- [ ] **Step 2: Tester manuellement le lancement du serveur**
- [ ] **Step 3: Commit**

---

### Task 7: Interface Frontend (HTML, CSS & JS Premium)

**Files:**
- Create: `src/public/index.html`
- Create: `src/public/css/style.css`
- Create: `src/public/js/app.js`

- [ ] **Step 1: Créer le fichier HTML public src/public/index.html**
- [ ] **Step 2: Créer le fichier CSS public src/public/css/style.css**
- [ ] **Step 3: Créer le fichier JS public src/public/js/app.js**
