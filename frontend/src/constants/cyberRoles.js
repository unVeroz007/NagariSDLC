/**
 * Grup Keamanan Siber — sumber acuan otorisasi untuk jalur audit Keamanan Siber.
 *
 * Grup ini terpisah dari Grup Perencanaan dan Quality Assurance (lihat `roles.js`):
 * jalur QA boleh didisposisikan ke seluruh analis grup Perencanaan-QA, sedangkan jalur
 * Siber tidak ikut diperluas karena orangnya berbeda. Cerminan backend-nya
 * `App\Enums\TestingTrack::CYBER->testerRoles()` (`[pentester, cyber_lead]`) dan
 * matriks role pada `App\Services\ProjectWorkflowService` (`CYBER_IN_PROGRESS`,
 * `CYBER_PASSED`). Keduanya harus diubah bersamaan: menambah role di sini tanpa
 * menambahkannya di backend membuat pengguna melihat opsi yang setiap aksinya ditolak
 * 403.
 */

import { readRoleName } from './roles';

/**
 * Role yang sah menerima disposisi audit Keamanan Siber.
 *
 * Cermin `TestingTrack::CYBER->testerRoles()`: `pentester` sebagai pelaksana audit,
 * ditambah `cyber_lead` yang pada tim kecil kadang mengerjakan auditnya sendiri.
 * Dipakai penyaring daftar personel di Workspace Cyber — sebelumnya penyaring itu
 * memakai uji substring `'cyber'`/`'pentest'` pada nama role, yang bisa ikut meloloskan
 * role baru mana pun yang namanya kebetulan memuat kata itu.
 */
export const CYBER_DISPOSITION_ROLES = ['pentester', 'cyber_lead'];

/** Apakah pengguna ini sah menerima disposisi audit Keamanan Siber? */
export const isCyberDispositionEligible = (user) => CYBER_DISPOSITION_ROLES.includes(readRoleName(user));
