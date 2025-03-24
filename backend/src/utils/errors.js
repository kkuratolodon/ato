class ValidationError extends Error {
    constructor(message) {
        super(message); 
        this.name = "ValidationError";
    }
}

class AuthError extends Error {
    constructor(message) {
        super(message); 
        this.name = "AuthError";
    }
}

class ForbiddenError extends Error {
    constructor(message) {
        super(message); 
        this.name = "ForbiddenError";
    }
}

module.exports = { ValidationError, AuthError, ForbiddenError };
    