<script lang="ts" module>
  export interface FileProps {
    id: string;
    name: string;
    type: 'pdf' | 'image' | 'zip' | 'doc';
    size: string;
    date: string;
    uploaderAvatars: string[];
  }
</script>

<script lang="ts">
  let { file } = $props<{ file: FileProps }>();

  let iconConfig = $derived.by(() => {
    switch (file.type) {
      case 'pdf': return { icon: 'picture_as_pdf', bg: 'bg-red-50', text: 'text-red-500' };
      case 'image': return { icon: 'image', bg: 'bg-blue-50', text: 'text-blue-500' };
      case 'zip': return { icon: 'folder_zip', bg: 'bg-gray-100', text: 'text-gray-500' };
      case 'doc': return { icon: 'description', bg: 'bg-blue-50', text: 'text-blue-600' };
      default: return { icon: 'draft', bg: 'bg-surface-variant', text: 'text-on-surface-variant' };
    }
  });
</script>

<div class="bg-surface border border-outline-variant/30 rounded-xl p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0px_10px_25px_rgba(0,0,0,0.08)] transition-all flex flex-col h-full group">
  <div class="flex items-start justify-between mb-4">
    <div class="w-10 h-10 rounded {iconConfig.bg} flex items-center justify-center {iconConfig.text}">
      <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">{iconConfig.icon}</span>
    </div>
    <button class="text-outline hover:text-on-surface transition-colors opacity-0 group-hover:opacity-100 focus:outline-none">
      <span class="material-symbols-outlined">more_vert</span>
    </button>
  </div>
  <h4 class="font-title-md text-title-md text-on-surface mb-1 truncate" title={file.name}>{file.name}</h4>
  <p class="font-body-md text-body-md text-on-surface-variant mb-4">{file.size} • {file.date}</p>
  <div class="mt-auto flex items-center justify-between border-t border-outline-variant/20 pt-4">
    <div class="flex -space-x-2">
      {#each file.uploaderAvatars as avatar}
        <img alt="Avatar" class="w-6 h-6 rounded-full object-cover border border-surface" src={avatar}/>
      {/each}
    </div>
    <button class="px-3 py-1.5 border border-primary text-primary rounded-lg font-label-md text-label-md hover:bg-primary/5 transition-colors flex items-center gap-1 focus:outline-none">
      <span class="material-symbols-outlined text-[16px]">download</span>
      Download
    </button>
  </div>
</div>
