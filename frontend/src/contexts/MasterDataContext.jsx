import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { INITIAL_DIVISIONS, INITIAL_ROLES } from '../data/masterData';
import { roleService, divisionService } from '../services/api';
import toast from 'react-hot-toast';

const MasterDataContext = createContext(null);
const MODE = 'api';

export function MasterDataProvider({ children }) {
    const [divisions, setDivisions] = useState([]);
    const [roles, setRoles] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // ─────────────────────────────────────────────
    // Load master data from API
    // ─────────────────────────────────────────────
    const loadMasterData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [roleRes, divRes] = await Promise.all([
                roleService.getAll().catch(() => null),
                divisionService.getAll().catch(() => null),
            ]);

            if (roleRes && roleRes.data && Array.isArray(roleRes.data) && roleRes.data.length > 0) {
                const formattedRoles = roleRes.data.map(r => ({
                    id: r.id,
                    _apiId: r.id,
                    name: r.display_name || r.name,
                    code: r.name,
                    description: r.description || '',
                    menuAccess: 'Modul Standar',
                    usersCount: r.users_count ?? 0,
                }));
                setRoles(formattedRoles);
            } else {
                setRoles(INITIAL_ROLES);
            }

            if (divRes && divRes.data && Array.isArray(divRes.data) && divRes.data.length > 0) {
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
                setDivisions(INITIAL_DIVISIONS);
            }
        } catch {
            setRoles(INITIAL_ROLES);
            setDivisions(INITIAL_DIVISIONS);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
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
    const addRole = async (newRole) => {
        try {
            if (MODE === 'api') {
                const res = await roleService.create({
                    name: newRole.code || newRole.name.toLowerCase().replace(/\s+/g, '_'),
                    display_name: newRole.name,
                    description: newRole.description || '',
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
                menuAccess: newRole.menuAccess || 'Modul Standar',
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
                    display_name: updatedRole.name,
                    description: updatedRole.description,
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

    return (
        <MasterDataContext.Provider value={{
            divisions,
            roles,
            isLoading,
            addDivision,
            editDivision,
            deleteDivision,
            addRole,
            editRole,
            deleteRole,
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
