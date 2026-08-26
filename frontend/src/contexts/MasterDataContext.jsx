import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { groupService, roleService, divisionService } from '../services/api';
import toast from 'react-hot-toast';

const MasterDataContext = createContext(null);
const MODE = 'api';

export function MasterDataProvider({ children }) {
    const [divisions, setDivisions] = useState([]);
    const [roles, setRoles] = useState([]);
    const [groups, setGroups] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // ─────────────────────────────────────────────
    // Load master data from API
    //
    // Master data role dan divisi adalah acuan tata kelola: dipakai untuk
    // penugasan pengguna, penentuan divisi pemohon, dan matriks persetujuan.
    // Karena itu tidak ada lagi data contoh yang disisipkan saat API gagal atau
    // mengembalikan daftar kosong. Sebelumnya daftar bawaan dari berkas data statis
    // tampil di halaman Master Data seolah-olah tersimpan di database, padahal
    // barisnya tidak ada dan setiap ubah atau hapus pasti gagal. Berkas statis itu
    // sudah dihapus; kegagalan sekarang dilaporkan lewat toast dan daftar dibiarkan
    // kosong supaya keadaan sebenarnya terlihat.
    //
    // Grup kerja ikut dimuat di sini karena halaman Manajemen Role membutuhkannya
    // sekaligus: setiap role ditempatkan pada satu grup, dan daftar pilihannya harus
    // berasal dari tabel `groups`, bukan dari daftar tetap di frontend.
    // ─────────────────────────────────────────────
    const loadMasterData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [roleRes, divRes, groupRes] = await Promise.all([
                roleService.getAll().catch(() => null),
                divisionService.getAll().catch(() => null),
                groupService.getAll().catch(() => null),
            ]);

            if (roleRes && Array.isArray(roleRes.data)) {
                const formattedRoles = roleRes.data.map(r => ({
                    id: r.id,
                    _apiId: r.id,
                    name: r.display_name || r.name,
                    code: r.name,
                    description: r.description || '',

                    // Grup kerja yang menaungi role. Boleh kosong: role sistem seperti
                    // `super_admin` tidak mewakili unit kerja mana pun.
                    groupId: r.group_id ?? null,
                    groupCode: r.group?.code || null,
                    groupName: r.group?.name || null,

                    // Daftar path menu yang boleh dilihat role ini. Daftar kosong berarti
                    // TANPA pembatasan, bukan tanpa menu — lihat `Role::menuAccessPaths()`
                    // di backend. Sebelum ini nilainya adalah teks tetap "Modul Standar"
                    // yang tidak pernah dikirim maupun dibaca siapa pun.
                    menuAccess: Array.isArray(r.menu_access) ? r.menu_access : [],

                    usersCount: r.users_count ?? 0,
                }));
                setRoles(formattedRoles);
            } else {
                setRoles([]);
                toast.error('Gagal memuat daftar role dari server.');
            }

            if (divRes && Array.isArray(divRes.data)) {
                const formattedDivisions = divRes.data.map(d => ({
                    id: d.id,
                    _apiId: d.id,
                    name: d.name,
                    code: d.code || `DIV-${d.id}`,
                    description: d.description || '',
                    usersCount: d.users_count ?? 0,
                }));
                setDivisions(formattedDivisions);
            } else {
                setDivisions([]);
                toast.error('Gagal memuat daftar divisi dari server.');
            }

            if (groupRes && Array.isArray(groupRes.data)) {
                setGroups(groupRes.data.map(g => ({
                    id: g.id,
                    _apiId: g.id,
                    code: g.code,
                    name: g.name,
                    description: g.description || '',
                    rolesCount: g.roles_count ?? 0,
                    usersCount: g.users_count ?? 0,
                    roles: Array.isArray(g.roles) ? g.roles : [],
                })));
            } else {
                setGroups([]);
                toast.error('Gagal memuat daftar grup kerja dari server.');
            }
        } catch {
            toast.error('Gagal memuat master data dari server.');
            setRoles([]);
            setDivisions([]);
            setGroups([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Pemuatan pertama saat provider dipasang. setState sinkron di effect memang
    // dilarang aturan react-hooks, tetapi di sini pemicunya adalah pengambilan
    // data awal dari API (bukan turunan state yang bisa dihitung saat render).
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan awal dari API, lihat catatan di atas
        loadMasterData();
    }, [loadMasterData]);

    // ─────────────────────────────────────────────
    // Division CRUD — synced with API
    // ─────────────────────────────────────────────
    const addDivision = async (newDiv) => {
        try {
            if (MODE === 'api') {
                const res = await divisionService.create({
                    code: newDiv.code || newDiv.name.substring(0, 5).toUpperCase().replace(/\s+/g, '-'),
                    name: newDiv.name,
                    description: newDiv.description || '',
                });
                if (res && res.data) {
                    await loadMasterData(); // Refresh from DB
                    toast.success(`Divisi "${newDiv.name}" berhasil ditambahkan & tersimpan ke database!`);
                    return;
                }
            }
            // Fallback: local only
            const id = `DIV-0${divisions.length + 1}`;
            const createdObj = {
                id, name: newDiv.name,
                code: newDiv.code || `DIV-${newDiv.name.substring(0, 3).toUpperCase()}`,
                description: newDiv.description || '',
            };
            setDivisions(prev => [createdObj, ...prev]);
            toast.success(`Divisi "${newDiv.name}" berhasil ditambahkan!`);
        } catch (err) {
            toast.error(`Gagal menambahkan divisi: ${err.message}`);
        }
    };

    const editDivision = async (id, updatedDiv) => {
        try {
            const apiId = typeof id === 'number' ? id : divisions.find(d => d.id === id)?._apiId || id;
            if (MODE === 'api' && typeof apiId === 'number') {
                await divisionService.update(apiId, {
                    code: updatedDiv.code,
                    name: updatedDiv.name,
                    description: updatedDiv.description,
                });
                await loadMasterData();
                toast.success(`Divisi "${updatedDiv.name}" berhasil diperbarui di database!`);
                return;
            }
            setDivisions(prev => prev.map(d => d.id === id ? { ...d, ...updatedDiv } : d));
            toast.success(`Divisi "${updatedDiv.name || id}" berhasil diperbarui!`);
        } catch (err) {
            toast.error(`Gagal memperbarui divisi: ${err.message}`);
        }
    };

    const deleteDivision = async (id) => {
        try {
            const apiId = typeof id === 'number' ? id : divisions.find(d => d.id === id)?._apiId || id;
            if (MODE === 'api' && typeof apiId === 'number') {
                await divisionService.delete(apiId);
                await loadMasterData();
                toast.success('Divisi berhasil dihapus dari database!');
                return;
            }
            const target = divisions.find(d => d.id === id);
            setDivisions(prev => prev.filter(d => d.id !== id));
            toast.success(`Divisi "${target ? target.name : id}" berhasil dihapus!`);
        } catch (err) {
            toast.error(`Gagal menghapus divisi: ${err.message}`);
        }
    };

    // ─────────────────────────────────────────────
    // Role CRUD — synced with API
    // ─────────────────────────────────────────────
    // Penempatan grup dan pembatasan menu selalu dikirim apa adanya, termasuk saat
    // nilainya kosong: `group_id: null` berarti role dikeluarkan dari grup, dan
    // `menu_access: []` berarti pembatasan dicabut. Menghilangkan key-nya ketika kosong
    // akan membuat kedua tindakan itu tidak pernah tersimpan.
    const roleWritePayload = (role) => ({
        display_name: role.name,
        description: role.description || '',
        group_id: role.groupId ? Number(role.groupId) : null,
        menu_access: Array.isArray(role.menuAccess) ? role.menuAccess : [],
    });

    const addRole = async (newRole) => {
        try {
            if (MODE === 'api') {
                const res = await roleService.create({
                    name: newRole.code || newRole.name.toLowerCase().replace(/\s+/g, '_'),
                    ...roleWritePayload(newRole),
                });
                if (res && res.data) {
                    await loadMasterData();
                    toast.success(`Role "${newRole.name}" berhasil ditambahkan & tersimpan ke database!`);
                    return;
                }
            }
            const id = `ROL-0${roles.length + 1}`;
            const createdObj = {
                id, name: newRole.name,
                code: newRole.code || newRole.name.toLowerCase().replace(/\s+/g, '_'),
                description: newRole.description || '',
                groupId: newRole.groupId ?? null,
                menuAccess: Array.isArray(newRole.menuAccess) ? newRole.menuAccess : [],
            };
            setRoles(prev => [...prev, createdObj]);
            toast.success(`Role "${newRole.name}" berhasil ditambahkan!`);
        } catch (err) {
            toast.error(`Gagal menambahkan role: ${err.message}`);
        }
    };

    const editRole = async (id, updatedRole) => {
        try {
            const apiId = typeof id === 'number' ? id : roles.find(r => r.id === id)?._apiId || id;
            if (MODE === 'api' && typeof apiId === 'number') {
                await roleService.update(apiId, {
                    name: updatedRole.code,
                    ...roleWritePayload(updatedRole),
                });
                await loadMasterData();
                toast.success(`Role "${updatedRole.name}" berhasil diperbarui di database!`);
                return;
            }
            setRoles(prev => prev.map(r => r.id === id ? { ...r, ...updatedRole } : r));
            toast.success(`Role "${updatedRole.name || id}" berhasil diperbarui!`);
        } catch (err) {
            toast.error(`Gagal memperbarui role: ${err.message}`);
        }
    };

    const deleteRole = async (id) => {
        try {
            const target = roles.find(r => r.id === id);
            if (target && target.code === 'super_admin') {
                toast.error('Role "Super Admin" adalah role utama dan TIDAK BISA dihapus!');
                return false;
            }
            const apiId = typeof id === 'number' ? id : target?._apiId || id;
            if (MODE === 'api' && typeof apiId === 'number') {
                await roleService.delete(apiId);
                await loadMasterData();
                toast.success(`Role "${target?.name}" berhasil dihapus dari database!`);
                return true;
            }
            setRoles(prev => prev.filter(r => r.id !== id));
            toast.success(`Role "${target ? target.name : id}" berhasil dihapus!`);
            return true;
        } catch (err) {
            toast.error(`Gagal menghapus role: ${err.message}`);
            return false;
        }
    };

    // ─────────────────────────────────────────────
    // Group CRUD — synced with API
    //
    // Grup adalah pengelompokan role, bukan gerbang otorisasi: memindahkan role antar
    // grup mengubah pengelompokan dan tampilan, bukan hak transisi status. Hak itu tetap
    // ditentukan nama role di backend.
    // ─────────────────────────────────────────────
    const addGroup = async (newGroup) => {
        try {
            const res = await groupService.create({
                code: newGroup.code,
                name: newGroup.name,
                description: newGroup.description || '',
            });
            if (res && res.data) {
                await loadMasterData();
                toast.success(`Grup "${newGroup.name}" berhasil ditambahkan & tersimpan ke database!`);
                return true;
            }
            return false;
        } catch (err) {
            toast.error(`Gagal menambahkan grup: ${err.message}`);
            return false;
        }
    };

    const editGroup = async (id, updatedGroup) => {
        try {
            await groupService.update(id, {
                code: updatedGroup.code,
                name: updatedGroup.name,
                description: updatedGroup.description || '',
            });
            await loadMasterData();
            toast.success(`Grup "${updatedGroup.name}" berhasil diperbarui di database!`);
            return true;
        } catch (err) {
            toast.error(`Gagal memperbarui grup: ${err.message}`);
            return false;
        }
    };

    const deleteGroup = async (id) => {
        try {
            const target = groups.find(g => g.id === id);
            await groupService.delete(id);
            await loadMasterData();
            toast.success(`Grup "${target ? target.name : id}" berhasil dihapus dari database!`);
            return true;
        } catch (err) {
            // Backend menolak penghapusan grup yang masih berisi role, dan pesannya sudah
            // menyebutkan berapa role yang harus dipindahkan lebih dulu.
            toast.error(`Gagal menghapus grup: ${err.message}`);
            return false;
        }
    };

    return (
        <MasterDataContext.Provider value={{
            divisions,
            roles,
            groups,
            isLoading,
            addDivision,
            editDivision,
            deleteDivision,
            addRole,
            editRole,
            deleteRole,
            addGroup,
            editGroup,
            deleteGroup,
            refreshMasterData: loadMasterData,
        }}>
            {children}
        </MasterDataContext.Provider>
    );
}

export function useMasterData() {
    const context = useContext(MasterDataContext);
    if (!context) {
        throw new Error('useMasterData must be used within a MasterDataProvider');
    }
    return context;
}
