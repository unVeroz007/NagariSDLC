/**
 * Aturan kekuatan password sisi peramban, cermin dari
 * `backend/app/Support/PasswordPolicy.php`.
 *
 * Sebelumnya aturan yang sama ditulis ulang di empat halaman (Register,
 * ResetPassword, Settings, dan Users) dengan isi yang tidak seragam: dua halaman
 * hanya memeriksa panjang 8 karakter, sehingga administrator dan pengguna yang
 * mengganti password menerima 422 dari server tanpa pernah diberi tahu syarat
 * sebenarnya. Satu sumber aturan membuat pesan di seluruh halaman sama dengan
 * yang benar-benar diperiksa backend.
 *
 * Pemeriksaan di sini hanya untuk memberi umpan balik cepat. Keputusan akhir
 * tetap milik backend.
 */

export const PASSWORD_MIN_LENGTH = 8;

/** Karakter spesial yang diterima; harus sama dengan PasswordPolicy::SPECIAL_CHARACTERS. */
export const PASSWORD_SPECIAL_CHARACTERS = '@$!%*#?&._-';

const PASSWORD_COMPLEXITY_PATTERNS = [/[a-z]/, /[A-Z]/, /[0-9]/, /[@$!%*#?&._-]/];

export const PASSWORD_COMPLEXITY_MESSAGE =
    `Password harus mengandung huruf kecil, huruf besar, angka, dan karakter spesial (${PASSWORD_SPECIAL_CHARACTERS}).`;

export const PASSWORD_REQUIREMENT_HINT =
    `Minimal ${PASSWORD_MIN_LENGTH} karakter, mengandung huruf kecil, huruf besar, angka, dan karakter spesial (${PASSWORD_SPECIAL_CHARACTERS}).`;

/**
 * Pesan kesalahan pertama untuk sebuah password, atau null bila sudah memenuhi
 * syarat.
 *
 * @param {string} password
 * @returns {string|null}
 */
export function getPasswordError(password) {
    const value = typeof password === 'string' ? password : '';

    if (!value) return 'Password wajib diisi.';
    if (value.length < PASSWORD_MIN_LENGTH) return `Password minimal ${PASSWORD_MIN_LENGTH} karakter.`;
    if (!PASSWORD_COMPLEXITY_PATTERNS.every((pattern) => pattern.test(value))) {
        return PASSWORD_COMPLEXITY_MESSAGE;
    }

    return null;
}

/**
 * @param {string} password
 * @returns {boolean}
 */
export function isPasswordValid(password) {
    return getPasswordError(password) === null;
}
