'use client';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/server/utils/supabase-client';
import { PieChart, BarChart, Radar, Clipboard, Plus, X, Edit2, CheckCircle, Save } from 'lucide-react';

export default function SkillsDashboard({ resumeId }) {
    const [skills, setSkills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeCategory, setActiveCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [editingSkill, setEditingSkill] = useState(null);
    const [skillLevel, setSkillLevel] = useState('intermediate');
    const [newSkillName, setNewSkillName] = useState('');
    const [newSkillCategory, setNewSkillCategory] = useState('technical');
    const [addingSkill, setAddingSkill] = useState(false);
    const [saving, setSaving] = useState(false);
    const [notification, setNotification] = useState(null);

    useEffect(() => {
        if (!resumeId) return;
        fetchSkills();
    }, [resumeId]);

    const fetchSkills = async () => {
        try {
            setLoading(true);

            // Get skills directly connected to this resume
            const { data: resumeSkills, error: skillsError } = await supabase
                .from('resume_skills')
                .select(`
          id,
          skill_id,
          level,
          skills(id, name, category)
        `)
                .eq('resume_id', resumeId);

            if (skillsError) throw skillsError;

            // Format skills data
            const formattedSkills = resumeSkills.map(item => ({
                id: item.id,
                skillId: item.skill_id,
                name: item.skills.name,
                category: item.skills.category,
                level: item.level || 'intermediate'
            }));

            setSkills(formattedSkills);
        } catch (error) {
            console.error('Error fetching skills:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    // Filtered skills based on category and search
    const filteredSkills = useMemo(() => {
        return skills.filter(skill => {
            const matchesCategory = activeCategory === 'all' || skill.category === activeCategory;
            const matchesSearch = !searchQuery ||
                skill.name.toLowerCase().includes(searchQuery.toLowerCase());

            return matchesCategory && matchesSearch;
        });
    }, [skills, activeCategory, searchQuery]);

    // Group skills by category for summary stats
    const skillsByCategory = useMemo(() => {
        const categories = {};
        skills.forEach(skill => {
            const category = skill.category || 'other';
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push(skill);
        });
        return categories;
    }, [skills]);

    // Skills level breakdown
    const skillLevelBreakdown = useMemo(() => {
        const levels = {
            beginner: 0,
            intermediate: 0,
            advanced: 0,
            expert: 0
        };

        skills.forEach(skill => {
            levels[skill.level] = (levels[skill.level] || 0) + 1;
        });

        return levels;
    }, [skills]);

    const handleAddSkill = async () => {
        if (!newSkillName.trim()) {
            setNotification({
                type: 'error',
                message: 'Skill name is required'
            });
            return;
        }

        try {
            setSaving(true);

            // First check if the skill already exists
            const { data: existingSkills, error: searchError } = await supabase
                .from('skills')
                .select('id, name')
                .ilike('name', newSkillName.trim())
                .limit(1);

            if (searchError) throw searchError;

            let skillId;

            // If skill doesn't exist, create it
            if (!existingSkills || existingSkills.length === 0) {
                const { data: newSkill, error: createError } = await supabase
                    .from('skills')
                    .insert([{
                        name: newSkillName.trim(),
                        category: newSkillCategory
                    }])
                    .select('id')
                    .single();

                if (createError) throw createError;
                skillId = newSkill.id;
            } else {
                skillId = existingSkills[0].id;
            }

            // Now connect the skill to the resume
            const { data: resumeSkill, error: connectError } = await supabase
                .from('resume_skills')
                .insert([{
                    resume_id: resumeId,
                    skill_id: skillId,
                    level: skillLevel
                }])
                .select('id')
                .single();

            if (connectError) throw connectError;

            // Refresh skills list
            fetchSkills();

            // Reset form
            setNewSkillName('');
            setNewSkillCategory('technical');
            setSkillLevel('intermediate');
            setAddingSkill(false);

            setNotification({
                type: 'success',
                message: 'Skill added successfully'
            });

        } catch (error) {
            console.error('Error adding skill:', error);
            setNotification({
                type: 'error',
                message: error.message
            });
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateSkill = async (skillId) => {
        try {
            setSaving(true);

            const { error } = await supabase
                .from('resume_skills')
                .update({ level: skillLevel })
                .eq('id', skillId);

            if (error) throw error;

            // Update local state
            setSkills(skills.map(skill =>
                skill.id === skillId ? { ...skill, level: skillLevel } : skill
            ));

            setEditingSkill(null);

            setNotification({
                type: 'success',
                message: 'Skill updated successfully'
            });

        } catch (error) {
            console.error('Error updating skill:', error);
            setNotification({
                type: 'error',
                message: error.message
            });
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveSkill = async (skillId) => {
        try {
            setSaving(true);

            const { error } = await supabase
                .from('resume_skills')
                .delete()
                .eq('id', skillId);

            if (error) throw error;

            // Update local state
            setSkills(skills.filter(skill => skill.id !== skillId));

            setNotification({
                type: 'success',
                message: 'Skill removed successfully'
            });

        } catch (error) {
            console.error('Error removing skill:', error);
            setNotification({
                type: 'error',
                message: error.message
            });
        } finally {
            setSaving(false);
        }
    };

    // Clear notification after 3 seconds
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => {
                setNotification(null);
            }, 3000);

            return () => clearTimeout(timer);
        }
    }, [notification]);

    const getLevelBadge = (level) => {
        const badges = {
            beginner: "bg-blue-100 text-blue-800",
            intermediate: "bg-green-100 text-green-800",
            advanced: "bg-purple-100 text-purple-800",
            expert: "bg-pink-100 text-pink-800"
        };

        return badges[level] || "bg-gray-100 text-gray-800";
    };

    const getCategoryIcon = (category) => {
        switch (category) {
            case 'technical':
                return <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>;
            case 'soft':
                return <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 005 10a6 6 0 0012 0c0-.526-.077-1.034-.196-1.516A5.001 5.001 0 0010 11z" clipRule="evenodd" />
                </svg>;
            case 'tool':
                return <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
                </svg>;
            default:
                return <Clipboard className="h-4 w-4" />;
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-52">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brown"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                Error: {error}
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-sm border border-brown-light overflow-hidden">
            <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-medium text-gray-800">Skills Dashboard</h2>
                    <button
                        onClick={() => setAddingSkill(true)}
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brown hover:bg-brown-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brown"
                    >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Skill
                    </button>
                </div>

                {notification && (
                    <div className={`mb-4 p-3 rounded-lg ${notification.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                        }`}>
                        {notification.message}
                    </div>
                )}

                {/* Skills Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-gray-700">Total Skills</h3>
                            <span className="text-2xl font-bold text-brown">{skills.length}</span>
                        </div>
                        <div className="text-xs text-gray-500">
                            {Object.keys(skillsByCategory).length} categories
                        </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-gray-700">Skill Breakdown</h3>
                        </div>
                        <div className="text-xs space-y-1">
                            {Object.entries(skillsByCategory).map(([category, skills]) => (
                                <div key={category} className="flex justify-between">
                                    <span className="capitalize">{category}</span>
                                    <span>{skills.length}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-gray-700">Skill Levels</h3>
                        </div>
                        <div className="text-xs space-y-1">
                            {Object.entries(skillLevelBreakdown).map(([level, count]) => (
                                <div key={level} className="flex justify-between">
                                    <span className="capitalize">{level}</span>
                                    <span>{count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Add Skill Form */}
                {addingSkill && (
                    <div className="bg-gray-50 p-4 rounded-lg mb-6">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-sm font-medium text-gray-700">Add New Skill</h3>
                            <button
                                onClick={() => setAddingSkill(false)}
                                className="text-gray-400 hover:text-gray-500"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label htmlFor="skillName" className="block text-xs font-medium text-gray-700 mb-1">
                                    Skill Name
                                </label>
                                <input
                                    type="text"
                                    id="skillName"
                                    value={newSkillName}
                                    onChange={(e) => setNewSkillName(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brown focus:border-brown text-sm"
                                    placeholder="Enter skill name"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label htmlFor="category" className="block text-xs font-medium text-gray-700 mb-1">
                                        Category
                                    </label>
                                    <select
                                        id="category"
                                        value={newSkillCategory}
                                        onChange={(e) => setNewSkillCategory(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brown focus:border-brown text-sm"
                                    >
                                        <option value="technical">Technical</option>
                                        <option value="soft">Soft Skill</option>
                                        <option value="tool">Tool/Software</option>
                                        <option value="language">Language</option>
                                        <option value="certification">Certification</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>

                                <div>
                                    <label htmlFor="level" className="block text-xs font-medium text-gray-700 mb-1">
                                        Proficiency Level
                                    </label>
                                    <select
                                        id="level"
                                        value={skillLevel}
                                        onChange={(e) => setSkillLevel(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brown focus:border-brown text-sm"
                                    >
                                        <option value="beginner">Beginner</option>
                                        <option value="intermediate">Intermediate</option>
                                        <option value="advanced">Advanced</option>
                                        <option value="expert">Expert</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <button
                                    onClick={handleAddSkill}
                                    disabled={saving || !newSkillName.trim()}
                                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brown hover:bg-brown-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brown disabled:opacity-50"
                                >
                                    {saving ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="h-4 w-4 mr-1" />
                                            Add Skill
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Skills Filter */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 space-y-3 sm:space-y-0">
                    <div className="flex space-x-3">
                        <button
                            onClick={() => setActiveCategory('all')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-full ${activeCategory === 'all'
                                    ? 'bg-brown text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            All
                        </button>

                        {Object.keys(skillsByCategory).map(category => (
                            <button
                                key={category}
                                onClick={() => setActiveCategory(category)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-full ${activeCategory === category
                                        ? 'bg-brown text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                {category.charAt(0).toUpperCase() + category.slice(1)}
                            </button>
                        ))}
                    </div>

                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search skills..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full sm:w-64 pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-brown focus:border-brown"
                        />
                        <div className="absolute left-2.5 top-2.5 text-gray-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Skills List */}
                {filteredSkills.length === 0 ? (
                    <div className="bg-gray-50 p-6 text-center rounded-lg">
                        <Clipboard className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                        <p className="text-gray-500">No skills found</p>
                        {activeCategory !== 'all' || searchQuery ? (
                            <p className="text-sm text-gray-400 mt-1">
                                Try changing your filters
                            </p>
                        ) : (
                            <button
                                onClick={() => setAddingSkill(true)}
                                className="mt-3 text-brown hover:text-brown-dark font-medium text-sm"
                            >
                                Add your first skill
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead>
                                <tr>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Skill
                                    </th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Category
                                    </th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Level
                                    </th>
                                    <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredSkills.map(skill => (
                                    <tr key={skill.id}>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{skill.name}</div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <span className="mr-1.5 text-gray-500">
                                                    {getCategoryIcon(skill.category)}
                                                </span>
                                                <span className="text-sm text-gray-500 capitalize">{skill.category}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            {editingSkill === skill.id ? (
                                                <select
                                                    value={skillLevel}
                                                    onChange={(e) => setSkillLevel(e.target.value)}
                                                    className="text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-brown focus:border-brown p-1"
                                                >
                                                    <option value="beginner">Beginner</option>
                                                    <option value="intermediate">Intermediate</option>
                                                    <option value="advanced">Advanced</option>
                                                    <option value="expert">Expert</option>
                                                </select>
                                            ) : (
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getLevelBadge(skill.level)}`}>
                                                    {skill.level.charAt(0).toUpperCase() + skill.level.slice(1)}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                            {editingSkill === skill.id ? (
                                                <div className="flex justify-end space-x-2">
                                                    <button
                                                        onClick={() => handleUpdateSkill(skill.id)}
                                                        disabled={saving}
                                                        className="text-green-600 hover:text-green-900"
                                                    >
                                                        <Save className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingSkill(null)}
                                                        className="text-gray-400 hover:text-gray-500"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex justify-end space-x-2">
                                                    <button
                                                        onClick={() => {
                                                            setEditingSkill(skill.id);
                                                            setSkillLevel(skill.level);
                                                        }}
                                                        className="text-blue-600 hover:text-blue-900"
                                                    >
                                                        <Edit2 className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleRemoveSkill(skill.id)}
                                                        className="text-red-600 hover:text-red-900"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}