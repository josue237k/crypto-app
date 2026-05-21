const sseService = require('../../src/services/sseService');

describe('SSE Service Unit Tests', () => {
  beforeEach(() => {
    // S'assurer que la liste des clients est vide avant chaque test
    sseService.clearClients();
  });

  describe('registerClient', () => {
    it('should configure correct headers, send connection message and add client to register', () => {
      const mockReq = {
        on: jest.fn()
      };
      
      const mockRes = {
        writeHead: jest.fn(),
        write: jest.fn(),
        end: jest.fn()
      };

      sseService.registerClient(mockReq, mockRes);

      // Vérifier si writeHead a été appelé avec le statut 200 et les bons en-têtes
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      });

      // Vérifier si le message de connexion a été écrit
      expect(mockRes.write).toHaveBeenCalledWith(': connected\n\n');

      // Vérifier si le client a été ajouté au service
      expect(sseService.getClientsCount()).toBe(1);
    });
  });

  describe('broadcast', () => {
    it('should send the event and data in proper format to all registered clients', () => {
      const mockReq1 = { on: jest.fn() };
      const mockRes1 = { writeHead: jest.fn(), write: jest.fn(), end: jest.fn() };

      const mockReq2 = { on: jest.fn() };
      const mockRes2 = { writeHead: jest.fn(), write: jest.fn(), end: jest.fn() };

      sseService.registerClient(mockReq1, mockRes1);
      sseService.registerClient(mockReq2, mockRes2);

      expect(sseService.getClientsCount()).toBe(2);

      const eventName = 'priceUpdate';
      const eventData = { price: 62000, symbol: 'BTCUSDT' };
      
      sseService.broadcast(eventName, eventData);

      const expectedPayload = `event: ${eventName}\ndata: ${JSON.stringify(eventData)}\n\n`;

      expect(mockRes1.write).toHaveBeenCalledWith(expectedPayload);
      expect(mockRes2.write).toHaveBeenCalledWith(expectedPayload);
    });

    it('should broadcast message without event prefix if only data is provided', () => {
      const mockReq = { on: jest.fn() };
      const mockRes = { writeHead: jest.fn(), write: jest.fn(), end: jest.fn() };

      sseService.registerClient(mockReq, mockRes);

      const testData = { message: 'anonymous event' };
      sseService.broadcast(testData);

      const expectedPayload = `data: ${JSON.stringify(testData)}\n\n`;

      expect(mockRes.write).toHaveBeenCalledWith(expectedPayload);
    });

    it('should not crash if writing to a client throws an error', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const mockReq1 = { on: jest.fn() };
      let writeCalls = 0;
      const mockRes1 = {
        writeHead: jest.fn(),
        write: jest.fn(() => {
          writeCalls++;
          if (writeCalls > 1) {
            throw new Error('Connection lost');
          }
        }),
        end: jest.fn()
      };

      sseService.registerClient(mockReq1, mockRes1);
      
      // La diffusion ne doit pas propager l'erreur et faire crasher le service
      expect(() => {
        sseService.broadcast('test', { ok: true });
      }).not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('cleanup on request close event', () => {
    it('should remove the client from registered list when request close event is fired', () => {
      let closeListener;
      
      const mockReq = {
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            closeListener = callback;
          }
        })
      };
      
      const mockRes = {
        writeHead: jest.fn(),
        write: jest.fn(),
        end: jest.fn()
      };

      sseService.registerClient(mockReq, mockRes);
      expect(sseService.getClientsCount()).toBe(1);

      // Simuler l'événement 'close' de la requête du client
      expect(closeListener).toBeDefined();
      closeListener();

      // Le nombre de clients doit revenir à 0
      expect(sseService.getClientsCount()).toBe(0);
    });
  });

  describe('clearClients', () => {
    it('should close connection for all registered clients and reset client list', () => {
      const mockReq1 = { on: jest.fn() };
      const mockRes1 = { writeHead: jest.fn(), write: jest.fn(), end: jest.fn() };

      const mockReq2 = { on: jest.fn() };
      const mockRes2 = { writeHead: jest.fn(), write: jest.fn(), end: jest.fn() };

      sseService.registerClient(mockReq1, mockRes1);
      sseService.registerClient(mockReq2, mockRes2);

      expect(sseService.getClientsCount()).toBe(2);

      sseService.clearClients();

      // Vérifier que chaque client a bien été fermé avec res.end()
      expect(mockRes1.end).toHaveBeenCalled();
      expect(mockRes2.end).toHaveBeenCalled();

      // Vérifier que la liste a bien été vidée
      expect(sseService.getClientsCount()).toBe(0);
    });
  });
});
