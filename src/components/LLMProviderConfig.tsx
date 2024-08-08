import React, {useCallback, useEffect, useState} from 'react';
import '../styles/LLMProviderConfig.css';
import {invoke} from "@tauri-apps/api/tauri";
import LLMProviderConfigForm from "./LLMProviderConfigForm.tsx";
import RoundButton from './RoundButton.tsx';
import Switch from './Switch.tsx';
import { emit } from '@tauri-apps/api/event';
import FormDialog from './FormDialog.tsx';
import CustomSelect from './CustomSelect.tsx';

interface LLMProvider {
    id: string;
    name: string;
    api_type: string;
    description: string;
    is_official: boolean;
    is_enabled: boolean;
}

const LLMProviderConfig: React.FC = () => {
    const [LLMProviders, setLLMProviders] = useState<Array<LLMProvider>>([]);

    const handleToggle = (index: number) => {
        const newProviders = [...LLMProviders];
        newProviders[index].is_enabled = !newProviders[index].is_enabled;
        setLLMProviders(newProviders);

        invoke('update_llm_provider', {
            id: LLMProviders[index].id,
            name: LLMProviders[index].name,
            apiType: LLMProviders[index].api_type,
            description: LLMProviders[index].description,
            isEnabled: newProviders[index].is_enabled
        });
    };

    useEffect(() => {
        invoke<Array<LLMProvider>>('get_llm_providers')
            .then(setLLMProviders)
            .catch((e) => {
                emit('config-window-alert-dialog', {
                    text: '获取大模型提供商失败: ' + e,
                    type: 'error'
                });
            });
    }, []);

    const [newProviderDialogOpen, setNewProviderDialogOpen] = useState(false);
    const [providerName, setProviderName] = useState('');
    const [formApiType, setFormApiType] = useState('openai_api');
    const apiTypes = [
        { value: 'openai_api', label: 'OpenAI API' },
        { value: 'ollama', label: 'Ollama API' },
        { value: 'anthropic', label: 'Anthropic API' },
    ]

    const openNewProviderDialog = useCallback(() => {
        setNewProviderDialogOpen(true);
    }, []);
    const closeNewProviderDialog = useCallback(() => {
        setNewProviderDialogOpen(false);
    }, []);

    const handleNewProviderSubmit = () => {
        invoke('add_llm_provider', {
            name: providerName,
            apiType: formApiType
        }).then(() => {
            emit('config-window-success-notification');
            setProviderName('');
            setFormApiType('openai_api');
            closeNewProviderDialog();

            invoke<Array<LLMProvider>>('get_llm_providers')
                .then(setLLMProviders)
                .catch((e) => {
                    emit('config-window-alert-dialog', {
                        text: '获取大模型提供商失败: ' + e,
                        type: 'error'
                    });
                });
        }).catch((e) => {
            emit('config-window-alert-dialog', {
                text: '添加大模型提供商失败: ' + e,
                type: 'error'
            });
        });
    }

    return (
        <div className="model-config">
            {
                LLMProviders.map((provider, index) => {
                    return <div className='config-window-container provider-config-window' key={index}>
                        <div className='config-window-title'>
                            <div className='config-window-title-text-container'>
                                <span className='config-window-title-name'>{provider.name}</span>
                            </div>
                            
                            <label>
                                <Switch state={provider.is_enabled} onChange={() => handleToggle(index)} />
                            </label>
                        </div>

                        <LLMProviderConfigForm id={provider.id} apiType={provider.api_type}/>
                    </div>
                })
            }
            <FormDialog title='新增大模型提供商' isOpen={newProviderDialogOpen} onClose={closeNewProviderDialog} onSubmit={handleNewProviderSubmit}>
                <form className='form-group-container'>
                    <div className='form-group'>
                        <label>名称:</label>
                        <input className='form-input' type="text" name="name" value={providerName} onChange={e => setProviderName(e.target.value)} />
                    </div>
                    <div className='form-group'>
                        <label>API调用类型:</label>
                        <CustomSelect options={apiTypes} value={formApiType} onChange={setFormApiType} />
                    </div>
                </form>
            </FormDialog>
            <RoundButton text='新增' onClick={openNewProviderDialog} />
        </div>
    );
}

export default LLMProviderConfig;
