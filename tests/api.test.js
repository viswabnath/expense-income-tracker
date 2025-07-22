/**
 * API Client Unit Tests
 */

// Mock fetch globally
global.fetch = jest.fn();

class ApiClient {
    static async request(endpoint, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const response = await fetch(endpoint, { ...defaultOptions, ...options });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
    }

    static async get(endpoint) {
        return this.request(endpoint);
    }

    static async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    static async login(credentials) {
        return this.post('/api/login', credentials);
    }

    static async register(userData) {
        return this.post('/api/register', userData);
    }
}

describe('ApiClient', () => {
    beforeEach(() => {
        fetch.mockClear();
    });

    describe('request method', () => {
        test('should make successful GET request', async () => {
            const mockResponse = { data: 'test' };
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const result = await ApiClient.get('/api/test');

            expect(fetch).toHaveBeenCalledWith('/api/test', {
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            expect(result).toEqual(mockResponse);
        });

        test('should make successful POST request', async () => {
            const mockResponse = { success: true };
            const postData = { username: 'test', password: 'password' };
            
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const result = await ApiClient.post('/api/login', postData);

            expect(fetch).toHaveBeenCalledWith('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(postData),
            });
            expect(result).toEqual(mockResponse);
        });

        test('should throw error for failed request', async () => {
            fetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
            });

            await expect(ApiClient.get('/api/test'))
                .rejects.toThrow('HTTP error! status: 404');
        });

        test('should handle network errors', async () => {
            fetch.mockRejectedValueOnce(new Error('Network error'));

            await expect(ApiClient.get('/api/test'))
                .rejects.toThrow('Network error');
        });
    });

    describe('authentication endpoints', () => {
        test('should call login endpoint correctly', async () => {
            const credentials = { username: 'testuser', password: 'testpass' };
            const mockResponse = { success: true, token: 'abc123' };

            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const result = await ApiClient.login(credentials);

            expect(fetch).toHaveBeenCalledWith('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(credentials),
            });
            expect(result).toEqual(mockResponse);
        });

        test('should call register endpoint correctly', async () => {
            const userData = {
                name: 'Test User',
                username: 'testuser',
                email: 'test@example.com',
                password: 'password123'
            };
            const mockResponse = { success: true, userId: 1 };

            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const result = await ApiClient.register(userData);

            expect(fetch).toHaveBeenCalledWith('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData),
            });
            expect(result).toEqual(mockResponse);
        });
    });
});
