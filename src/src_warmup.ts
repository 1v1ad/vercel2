// Simple warm-up ping to wake Render free instance before other CORSed requests.
const backend = import.meta.env.VITE_BACKEND_URL;
if (backend) {
  fetch(`${backend}/api/health`, { credentials: 'include' }).catch(() => {});
}
