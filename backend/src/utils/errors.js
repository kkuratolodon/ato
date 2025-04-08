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

class PayloadTooLargeError extends Error {
    constructor(message) {
        super(message);
        this.name = "PayloadTooLargeError";
    }
}

class UnsupportedMediaTypeError extends Error {
    constructor(message) {
        super(message);
        this.name = "UnsupportedMediaTypeError";
    }
}

module.exports = {
    ValidationError,
    AuthError,
    ForbiddenError,
    PayloadTooLargeError,
    UnsupportedMediaTypeError
};
