import { MouseEventType, NitroEvent, RoomEngineTriggerWidgetEvent, RoomObjectVariable } from 'nitro-renderer';
import { createRef, useCallback, useEffect, useState } from 'react';
import { GetRoomEngine, GetRoomSession, GetSessionDataManager } from '../../../../../api';
import { DraggableWindow } from '../../../../../hooks/draggable-window/DraggableWindow';
import { CreateEventDispatcherHook } from '../../../../../hooks/events/event-dispatcher.base';
import { useRoomEngineEvent } from '../../../../../hooks/events/nitro/room/room-engine-event';
import { ColorUtils } from '../../../../../utils/ColorUtils';
import { RoomWidgetRoomObjectUpdateEvent } from '../../events';
import { FurnitureStickieData } from './FurnitureStickieData';
import { getStickieColorName, STICKIE_COLORS } from './FurnitureStickieUtils';
import { FurnitureStickieViewProps } from './FurnitureStickieView.types';

export function FurnitureStickieView(props: FurnitureStickieViewProps): JSX.Element
{
    const { events = null } = props;

    const [ stickieData, setStickieData ] = useState<FurnitureStickieData>(null);

    const textAreaRef = createRef<HTMLTextAreaElement>();

    const onNitroEvent = useCallback((event: NitroEvent) =>
    {
        switch(event.type)
        {
            case RoomEngineTriggerWidgetEvent.REQUEST_STICKIE: {
                const widgetEvent = (event as RoomEngineTriggerWidgetEvent);

                const roomObject = GetRoomEngine().getRoomObject(widgetEvent.roomId, widgetEvent.objectId, widgetEvent.category);

                if(!roomObject) return;
                
                const data = roomObject.model.getValue<string>(RoomObjectVariable.FURNITURE_ITEMDATA);

                if(data.length < 6) return;

                let color: string   = null;
                let text: string    = null;

                if(data.indexOf(' ') > 0)
                {
                    color   = data.slice(0, data.indexOf(' '));
                    text    = data.slice((data.indexOf(' ') + 1), data.length);
                }
                else
                {
                    color = data;
                }

                setStickieData(new FurnitureStickieData(widgetEvent.objectId, widgetEvent.category, color, text, (GetRoomSession(widgetEvent.roomId).isRoomOwner || GetSessionDataManager().isModerator), false));
                return;
            }
            case RoomWidgetRoomObjectUpdateEvent.FURNI_REMOVED: {
                const widgetEvent = (event as RoomWidgetRoomObjectUpdateEvent);

                setStickieData(prevState =>
                    {
                        if(!prevState || (widgetEvent.id !== prevState.objectId) || (widgetEvent.category !== prevState.category)) return prevState;

                        return null;
                    });
                return;
            }
        }
    }, []);

    useRoomEngineEvent(RoomEngineTriggerWidgetEvent.REQUEST_STICKIE, onNitroEvent);
    CreateEventDispatcherHook(RoomWidgetRoomObjectUpdateEvent.FURNI_REMOVED, events, onNitroEvent);

    const processAction = useCallback((type: string, value: string = null) =>
    {
        switch(type)
        {
            case 'close':
                setStickieData(null);
                return;
            case 'trash':
                setStickieData(prevState =>
                    {
                        if(!prevState) return null;

                        GetRoomEngine().deleteRoomObject(prevState.objectId, prevState.category);

                        return null;
                    });
                return;
            case 'changeColor':
                setStickieData(prevState =>
                    {
                        const newStickieData = new FurnitureStickieData(prevState.objectId, prevState.category, value, prevState.text, prevState.canModify);

                        GetRoomEngine().modifyRoomObjectData(newStickieData.objectId, newStickieData.category, newStickieData.color, newStickieData.text);

                        return newStickieData;
                    });
                return;
            case 'changeText': {
                setStickieData(prevState =>
                    {
                        const newStickieData = new FurnitureStickieData(prevState.objectId, prevState.category, prevState.color, value, prevState.canModify);

                        GetRoomEngine().modifyRoomObjectData(newStickieData.objectId, newStickieData.category, newStickieData.color, newStickieData.text);

                        return newStickieData;
                    });
                return;
            }
        }
    }, []);

    const onDocumentMouseDown = useCallback((event: MouseEvent) =>
    {
        if(event.target === textAreaRef.current) return;

        processAction('changeText', textAreaRef.current.value);
    }, [ textAreaRef, processAction ]);

    useEffect(() =>
    {
        if(!stickieData || !stickieData.isEditing) return;

        document.addEventListener(MouseEventType.MOUSE_DOWN, onDocumentMouseDown);

        return () => document.removeEventListener(MouseEventType.MOUSE_DOWN, onDocumentMouseDown);
    }, [ stickieData, onDocumentMouseDown ]);

    if(!stickieData) return null;

    function setIsEditing(): void
    {
        setStickieData(prevValue =>
            {
                return new FurnitureStickieData(prevValue.objectId, prevValue.category, prevValue.color, prevValue.text, prevValue.canModify, true);
            });
    }

    return (
        <DraggableWindow handle=".drag-handler">
            <div className={ "nitro-stickie nitro-stickie-image stickie-" + getStickieColorName(stickieData.color) }>
                <div className="d-flex align-items-center stickie-header drag-handler">
                    <div className="d-flex align-items-center flex-grow-1 h-100">
                        { stickieData.canModify && 
                        <>
                            <div className="nitro-stickie-image stickie-trash header-trash" onClick={ event => processAction('trash') }></div>
                            { STICKIE_COLORS.map((color, index) =>
                                {
                                    return <div className="stickie-color ml-1" key={ index } onClick={ event => processAction('changeColor', color) } style={ {backgroundColor: ColorUtils.makeColorHex(color) } } />
                                })}
                        </> }
                    </div>
                    <div className="d-flex align-items-center nitro-stickie-image stickie-close header-close" onClick={ event => processAction('close') }></div>
                </div>
                <div className="stickie-context">
                    { !stickieData.isEditing ? <div className="context-text" onClick={ event => stickieData.canModify && setIsEditing() }>{ stickieData.text }</div> : <textarea className="context-text" ref={ textAreaRef } defaultValue={ stickieData.text || '' } autoFocus></textarea> }
                </div>
            </div>
        </DraggableWindow>
    );
}