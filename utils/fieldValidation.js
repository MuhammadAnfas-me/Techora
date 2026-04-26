export function validate(field, res, message) {
    if (field === undefined || field === null || field === '') {
        res.status(400).json({
            success: false,
            message
        });
        return true; // indicate validation failed
    }
    return false;
}