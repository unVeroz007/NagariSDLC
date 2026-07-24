const fs = require('fs');
const file = 'frontend/src/pages/workspace/WorkspaceLead.jsx';
let content = fs.readFileSync(file, 'utf8');

const newHandleAssign = `    const handleAssign = () => {
        if (!selectedAnalyst) {
            toast.error('Pilih analyst terlebih dahulu!');
            return;
        }
        setIsSubmitting(true);
        
        updateProject(selectedProject.id, {
            analyst: selectedAnalyst,
            status: 'Review Analis',
            deadline: deadline || new Date().toISOString(),
            leadNote: notes
        });

        addNotification(
            'Tugas Review Ditugaskan',
            \`\${selectedAnalyst} ditugaskan untuk mereview \${selectedProject?.name}.\`,
            'success',
            '/workspace/analyst'
        );
        
        toast.success(\`Proyek \${selectedProject?.name} berhasil ditugaskan ke \${selectedAnalyst}\`);
        navigate('/queue');
        setIsSubmitting(false);

        const nextQueue = dispositionQueue.filter(p => p.id !== selectedProject.id);
        if (nextQueue.length > 0) {
            setSelectedProject(nextQueue[0]);
            setSelectedAnalyst('');
            setNotes('');
        } else {
            setSelectedProject(null);
        }
    };`;

const startIndex = content.indexOf('    const handleAssign = () => {');
const endIndex = content.indexOf('    };', startIndex) + 6;

if (startIndex !== -1 && endIndex !== -1) {
    content = content.substring(0, startIndex) + newHandleAssign + content.substring(endIndex);
    fs.writeFileSync(file, content);
}
