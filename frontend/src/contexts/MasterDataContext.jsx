import { createContext, useContext, useState, useEffect } from 'react';
import { INITIAL_DIVISIONS, INITIAL_ROLES } from '../data/masterData';
import { roleService, divisionService } from '../services/api';
import toast from 'react-hot-toast';

const MasterDataContext = createContext(null);
const MODE = import.meta.env.VITE_API_MODE || 'mock';

export function MasterDataProvider({ children }) {
    // Divisions state
    const [divisions, setDivisions] = useState(() => {
        const saved = localStorage.getItem('nagari_sdlc_master_divisions');
        if (saved) {
            try { return JSON.parse(saved); } catch { }
        }
        return INITIAL_DIVISIONS;
    });

    // Roles state
    const [roles, setRoles] = useState(() => {
        const saved = localStorage.getItem('nagari_sdlc_master_roles');
        if (saved) {
            try { return JSON.parse(saved); } catch { }
        }
        return INITIAL_ROLES;
    });

    // Load from API when MODE === 'api'
    useEffect(() => {
        if (MODE === 'api') {
            const loadMasterData = async () => {
                try {
                    const [roleRes, divRes] = await Promise.all([
                        roleService.getAll().catch(() => null),
                        divisionService.getAll().catch(() => null),
                    ]);

                    if (roleRes && roleRes.data && Array.isArray(roleRes.data) && roleRes.data.length > 0) {
                        const formattedRoles = roleRes.data.map(r => ({
                            id: `ROL-${r.id}`,
                            name: r.display_name || r.name,
                            code: r.name,
                            description: r.description || '',
                            menuAccess: 'Modul Standar',
                        }));
                        setRoles(formattedRoles);
                    }

                    if (divRes && divRes.data && Array.isArray(divRes.data) && divRes.data.length > 0) {
                        const formattedDivisions = divRes.data.map(d => ({
                            id: `DIV-${d.id}`,
                            name: d.name,
                            code: d.code || `DIV-${d.id}`,
                            description: `Divisi ${d.name}`,
                        }));
                        setDivisions(formattedDivisions);
                    }
                } catch (err) {
                    console.warn('[MasterDataContext] Failed to fetch master data from API:', err);
                }
            };
            loadMasterData();
        }
    }, []);


    // Save Divisions to LocalStorage
    const saveDivisions = (updated) => {
        setDivisions(updated);
        localStorage.setItem('nagari_sdlc_master_divisions', JSON.stringify(updated));
    };

    // Save Roles to LocalStorage
    const saveRoles = (updated) => {
        setRoles(updated);
        localStorage.setItem('nagari_sdlc_master_roles', JSON.stringify(updated));
    };

    // ─────────────────────────────────────────────
    // Division Functions
    // ─────────────────────────────────────────────
    const addDivision = (newDiv) => {
        const id = `DIV-0${divisions.length + 1}`;
        const createdObj = {
            id,
            name: newDiv.name,
            code: newDiv.code || `DIV-${newDiv.name.substring(0, 3).toUpperCase()}`,
            description: newDiv.description || '',
            createdAt: new Date().toISOString().split('T')[0],
        };
        const updated = [createdObj, ...divisions];
        saveDivisions(updated);
        toast.success(`Divisi "${newDiv.name}" berhasil ditambahkan!`);
    };

    const editDivision = (id, updatedDiv) => {
        const updated = divisions.map(d => d.id === id ? { ...d, ...updatedDiv } : d);
        saveDivisions(updated);
        toast.success(`Divisi "${updatedDiv.name || id}" berhasil diperbarui!`);
    };

    const deleteDivision = (id) => {
        const target = divisions.find(d => d.id === id);
        const updated = divisions.filter(d => d.id !== id);
        saveDivisions(updated);
        toast.success(`Divisi "${target ? target.name : id}" berhasil dihapus!`);
    };

    // ─────────────────────────────────────────────
    // Role Functions
    // ─────────────────────────────────────────────
    const addRole = (newRole) => {
        const id = `ROL-0${roles.length + 1}`;
        const createdObj = {
            id,
            name: newRole.name,
            code: newRole.code || newRole.name.toLowerCase().replace(/\s+/g, '_'),
            description: newRole.description || '',
            menuAccess: newRole.menuAccess || 'Modul Standar',
            createdAt: new Date().toISOString().split('T')[0],
        };
        const updated = [...roles, createdObj];
        saveRoles(updated);
        toast.success(`Role "${newRole.name}" berhasil ditambahkan!`);
    };

    const editRole = (id, updatedRole) => {
        const updated = roles.map(r => r.id === id ? { ...r, ...updatedRole } : r);
        saveRoles(updated);
        toast.success(`Role "${updatedRole.name || id}" berhasil diperbarui!`);
    };

    const deleteRole = (id) => {
        const target = roles.find(r => r.id === id);
        if (target && target.code === 'super_admin') {
            toast.error('Role "Super Admin" adalah role utama dan TIDAK BISA dihapus!');
            return false;
        }
        const updated = roles.filter(r => r.id !== id);
        saveRoles(updated);
        toast.success(`Role "${target ? target.name : id}" berhasil dihapus!`);
        return true;
    };

    return (
        <MasterDataContext.Provider value={{
            divisions,
            roles,
            addDivision,
            editDivision,
            deleteDivision,
            addRole,
            editRole,
            deleteRole,
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
