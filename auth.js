function auth(token) {
    return function (req, res, next) {
        const currToken = req.query?.token || req.body?.token;

        if (currToken === token) {
            next();
            return;
        }

        res.setHeader("content-type", "text/plain");
        res.status(401).send("Unauthorized.");
    };
}

module.exports = auth;
