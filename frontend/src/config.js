// Central API base configuration
// Priority: REACT_APP_API_BASE env var > development default (http://localhost:8000) > production default
const API = process.env.REACT_APP_API_BASE || (process.env.NODE_ENV === 'production' ? 'https://service-tool-backend.onrender.com' : 'http://localhost:8000');

export default API;
