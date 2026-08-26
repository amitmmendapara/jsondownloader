const crypto = require("crypto");

const DEFAULT_TOKEN_TTL_SECONDS = 24 * 60 * 60;

const getAdminConfig = () => {
    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;

    if (!username || !password) {
        throw new Error(
            "ADMIN_USERNAME and ADMIN_PASSWORD must be configured"
        );
    }

    const configuredTtl = Number(process.env.ADMIN_TOKEN_TTL_SECONDS);
    const tokenTtlSeconds =
        Number.isFinite(configuredTtl) && configuredTtl > 0
            ? Math.floor(configuredTtl)
            : DEFAULT_TOKEN_TTL_SECONDS;

    return {
        username,
        password,
        tokenSecret: process.env.ADMIN_AUTH_SECRET || password,
        tokenTtlSeconds,
    };
};

const safeEqual = (left, right) => {
    const leftBuffer = crypto
        .createHash("sha256")
        .update(String(left))
        .digest();
    const rightBuffer = crypto
        .createHash("sha256")
        .update(String(right))
        .digest();

    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const signTokenPayload = (encodedPayload, secret) =>
    crypto
        .createHmac("sha256", secret)
        .update(encodedPayload)
        .digest("base64url");

const createAdminToken = (username, secret, tokenTtlSeconds) => {
    const issuedAt = Math.floor(Date.now() / 1000);
    const payload = {
        sub: username,
        role: "admin",
        iat: issuedAt,
        exp: issuedAt + tokenTtlSeconds,
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
        "base64url"
    );
    const signature = signTokenPayload(encodedPayload, secret);

    return `${encodedPayload}.${signature}`;
};

const verifyAdminToken = (token, config) => {
    if (typeof token !== "string") {
        return null;
    }

    const tokenParts = token.split(".");

    if (tokenParts.length !== 2) {
        return null;
    }

    const [encodedPayload, suppliedSignature] = tokenParts;
    const expectedSignature = signTokenPayload(
        encodedPayload,
        config.tokenSecret
    );

    if (!safeEqual(suppliedSignature, expectedSignature)) {
        return null;
    }

    try {
        const payload = JSON.parse(
            Buffer.from(encodedPayload, "base64url").toString("utf8")
        );
        const currentTime = Math.floor(Date.now() / 1000);

        if (
            payload.role !== "admin" ||
            payload.sub !== config.username ||
            !Number.isInteger(payload.exp) ||
            payload.exp <= currentTime
        ) {
            return null;
        }

        return payload;
    } catch {
        return null;
    }
};

exports.adminLogin = (req, res) => {
    try {
        const config = getAdminConfig();
        const { username, password } = req.body || {};

        if (typeof username !== "string" || typeof password !== "string") {
            return res.status(400).json({
                success: false,
                message: "Username and password are required",
            });
        }

        if (
            !safeEqual(username, config.username) ||
            !safeEqual(password, config.password)
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password",
            });
        }

        const accessToken = createAdminToken(
            config.username,
            config.tokenSecret,
            config.tokenTtlSeconds
        );

        return res.status(200).json({
            success: true,
            message: "Admin login successful",
            data: {
                accessToken,
                tokenType: "Bearer",
                expiresIn: config.tokenTtlSeconds,
            },
        });
    } catch (error) {
        console.error("Admin login configuration error:", error);

        return res.status(500).json({
            success: false,
            message: "Admin authentication is not configured",
        });
    }
};

exports.requireAdminAuth = (req, res, next) => {
    try {
        const config = getAdminConfig();
        const authorization = req.headers.authorization;
        const bearerMatch =
            typeof authorization === "string"
                ? /^Bearer\s+(.+)$/i.exec(authorization.trim())
                : null;
        const payload = bearerMatch
            ? verifyAdminToken(bearerMatch[1], config)
            : null;

        if (!payload) {
            return res.status(401).json({
                success: false,
                message: "Valid admin Bearer token is required",
            });
        }

        req.admin = {
            username: payload.sub,
        };

        return next();
    } catch (error) {
        console.error("Admin authentication configuration error:", error);

        return res.status(500).json({
            success: false,
            message: "Admin authentication is not configured",
        });
    }
};
