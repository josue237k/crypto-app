/**
 * Service de gestion des connexions Server-Sent Events (SSE).
 * Permet de diffuser des flux de prix et d'alertes en temps réel à tous les clients connectés.
 */

let clients = [];

/**
 * Enregistre un nouveau client pour le flux SSE.
 * Configure les en-têtes HTTP appropriés et gère la déconnexion automatique.
 * 
 * @param {Object} req - L'objet Request d'Express.
 * @param {Object} res - L'objet Response d'Express.
 */
function registerClient(req, res) {
  try {
    // Configurer les en-têtes requis pour SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Empêche la mise en tampon par Nginx ou d'autres proxies
    });

    // Envoyer un message initial de connexion réussie
    res.write(': connected\n\n');
  } catch (error) {
    console.error('Erreur lors de l\'initialisation de la connexion client SSE:', error);
  }

  // Enregistrer le client
  clients.push(res);

  // Gérer la déconnexion du client
  req.on('close', () => {
    clients = clients.filter(c => c !== res);
  });
}

/**
 * Diffuse un événement avec ses données à tous les clients connectés.
 * Si une seule valeur est passée, elle est diffusée comme message SSE par défaut.
 * 
 * @param {string} event - Le nom de l'événement (ex: 'priceUpdate', 'alertTriggered').
 * @param {any} [data] - Les données de l'événement.
 */
function broadcast(event, data) {
  let message;
  
  if (data === undefined) {
    message = `data: ${JSON.stringify(event)}\n\n`;
  } else {
    message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  }

  clients.forEach(res => {
    try {
      res.write(message);
    } catch (error) {
      console.error('Erreur lors de la diffusion à un client SSE:', error);
    }
  });
}

/**
 * Retourne le nombre de clients actuellement connectés.
 * 
 * @returns {number} Le nombre de clients.
 */
function getClientsCount() {
  return clients.length;
}

/**
 * Ferme proprement toutes les connexions actives et vide la liste des clients.
 */
function clearClients() {
  clients.forEach(res => {
    try {
      res.end();
    } catch (error) {
      console.error('Erreur lors de la fermeture d\'une connexion SSE:', error);
    }
  });
  clients = [];
}

module.exports = {
  registerClient,
  broadcast,
  getClientsCount,
  clearClients
};
