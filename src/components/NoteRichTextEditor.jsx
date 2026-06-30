import React, { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered, ListChecks,
  Heading1, Heading2, Quote, Code, Link2, Undo2, Redo2
} from 'lucide-react';
import { noteContentToEditorHtml, normalizeNoteEditorHtml } from '../utils/noteContent';
import { readPersistedUiSize, usePersistentElementSize } from '../design-system/uiResize.js';

export const NOTES_EDITOR_RESIZE_KEY = 'fixer:ui-resize:notes-editor:content';
const NOTES_EDITOR_RESIZE_CONSTRAINTS = { minHeight: 160, defaultHeight: 220, maxHeight: 720 };

function ToolbarButton({ label, active = false, disabled = false, onClick, children }) {
  return <button
    type="button"
    className={`notes-rich-text-toolbar-button ${active ? 'is-active' : ''}`.trim()}
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
  >{children}</button>;
}

function NoteRichTextToolbar({ editor }) {
  if (!editor) return null;

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href ?? '';
    const url = window.prompt('Adres URL linku:', previousUrl);
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };

  return <div className="notes-rich-text-toolbar" role="toolbar" aria-label="Formatowanie treści notatki">
    <ToolbarButton label="Pogrubienie" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={15} /></ToolbarButton>
    <ToolbarButton label="Kursywa" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={15} /></ToolbarButton>
    <ToolbarButton label="Podkreślenie" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={15} /></ToolbarButton>
    <ToolbarButton label="Przekreślenie" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={15} /></ToolbarButton>
    <span className="notes-rich-text-toolbar-separator" aria-hidden="true" />
    <ToolbarButton label="Lista punktowana" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={15} /></ToolbarButton>
    <ToolbarButton label="Lista numerowana" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={15} /></ToolbarButton>
    <ToolbarButton label="Lista zadań" active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()}><ListChecks size={15} /></ToolbarButton>
    <span className="notes-rich-text-toolbar-separator" aria-hidden="true" />
    <ToolbarButton label="Nagłówek H1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 size={15} /></ToolbarButton>
    <ToolbarButton label="Nagłówek H2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={15} /></ToolbarButton>
    <ToolbarButton label="Cytat" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={15} /></ToolbarButton>
    <ToolbarButton label="Kod" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}><Code size={15} /></ToolbarButton>
    <ToolbarButton label="Link" active={editor.isActive('link')} onClick={setLink}><Link2 size={15} /></ToolbarButton>
    <span className="notes-rich-text-toolbar-separator" aria-hidden="true" />
    <ToolbarButton label="Cofnij" disabled={!editor.can().chain().focus().undo().run()} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={15} /></ToolbarButton>
    <ToolbarButton label="Ponów" disabled={!editor.can().chain().focus().redo().run()} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={15} /></ToolbarButton>
  </div>;
}

export default function NoteRichTextEditor({
  value,
  onChange,
  noteKey,
  disabled = false,
  placeholder = 'Treść notatki...',
  resizeKey = NOTES_EDITOR_RESIZE_KEY
}) {
  const lastEmittedRef = useRef(normalizeNoteEditorHtml(noteContentToEditorHtml(value)));
  const savedSize = readPersistedUiSize(resizeKey, NOTES_EDITOR_RESIZE_CONSTRAINTS);
  const resizeRef = usePersistentElementSize(resizeKey, {
    constraints: NOTES_EDITOR_RESIZE_CONSTRAINTS
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
        codeBlock: false,
        horizontalRule: false
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https'
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'notes-task-item'
        }
      }),
      Placeholder.configure({ placeholder })
    ],
    content: noteContentToEditorHtml(value),
    editable: !disabled,
    onUpdate: ({ editor: currentEditor }) => {
      const html = normalizeNoteEditorHtml(currentEditor.getHTML());
      lastEmittedRef.current = html;
      onChange?.(html);
    },
    editorProps: {
      attributes: {
        class: 'notes-rich-text-content',
        'aria-label': 'Treść notatki'
      }
    }
  }, [noteKey]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    lastEmittedRef.current = normalizeNoteEditorHtml(noteContentToEditorHtml(value));
  }, [noteKey]);

  useEffect(() => {
    if (!editor) return;
    const normalizedValue = normalizeNoteEditorHtml(noteContentToEditorHtml(value));
    if (normalizedValue === lastEmittedRef.current) return;
    lastEmittedRef.current = normalizedValue;
    editor.commands.setContent(noteContentToEditorHtml(value) || '', false);
  }, [value, editor, noteKey]);

  return <div className={`notes-rich-text-shell ${disabled ? 'is-disabled' : ''}`.trim()}>
    <NoteRichTextToolbar editor={editor} />
    <div
      ref={resizeRef}
      className="notes-rich-text-editor-wrap"
      style={savedSize?.height ? { height: `${savedSize.height}px` } : undefined}
    >
      <EditorContent editor={editor} className="notes-rich-text-editor" />
    </div>
  </div>;
}
