export function metricMiddleware({ service, url }) {
    return (req, res, next) => {
        const start = Date.now();

        res.on('finish', () => {
            fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    service,
                    method: req.method,
                    status: res.statusCode,
                    latencyMs: Date.now() - start
                })
            }).catch((err) => {
                console.error('Error sending metrics:', err);
            });
        });
        
            next();
        }
}