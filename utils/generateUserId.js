import crypto from "crypto"
export default function generateUserId(prefix = "#USER"){
    const short = crypto.randomBytes(3).toString("hex")
    return `${prefix}_${short}`
}