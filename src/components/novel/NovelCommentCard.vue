<script setup lang="ts">
import type { NovelCommentItem } from '@/api/novel/types'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { deleteNovelComment, likeNovelComment } from '@/api/novel'
import { showMsg } from '@/components/MessageBox'
import UserAvatar from '@/components/UserAvatar.vue'
import { useUserStore } from '@/store/userStore'
import { formatNovelTime } from '@/utils/novelText'

defineOptions({ name: 'NovelCommentCard' })

const { comment, showExcerpt } = defineProps<{
  comment: NovelCommentItem
  /** 段评列表里标注「针对哪一段」 */
  showExcerpt?: boolean
}>()

const emit = defineEmits<{
  likeChange: [commentID: number, liked: boolean]
  deleted: [commentID: number]
}>()

const { userInfo } = useUserStore()
const canDelete = computed(() => userInfo.userID === comment.authorID)
const targetLabel = computed(() => {
  if (comment.targetType === 'paragraph')
    return `第${comment.paragraphIndex + 1}段`
  if (comment.targetType === 'chapter')
    return '章评'
  return '书评'
})

async function onLike() {
  const ok = await likeNovelComment(comment.commentID)
  if (!ok) {
    showMsg('操作失败')
    return
  }
  emit('likeChange', comment.commentID, !comment.isLiked)
}

async function onDelete() {
  if (!window.confirm('删除这条评论？'))
    return
  const ok = await deleteNovelComment(comment.commentID)
  if (!ok) {
    showMsg('删除失败')
    return
  }
  emit('deleted', comment.commentID)
}
</script>

<template>
  <li class="novel-cmt" :class="{ 'novel-cmt--mine': canDelete }">
    <UserAvatar
      :src="comment.authorAvatar"
      :user-id="comment.authorID"
      :user-name="comment.author"
      :user-score="comment.authorScore"
      :user-identity="comment.authorIdentity"
      size="compact"
      no-profile-link
    />
    <div class="novel-cmt__body">
      <div class="novel-cmt__head">
        <span class="novel-cmt__name">{{ comment.author || '匿名' }}</span>
        <time class="novel-cmt__time" :datetime="comment.commentTime">{{ formatNovelTime(comment.commentTime) }}</time>
        <span v-if="showExcerpt" class="novel-cmt__tag">{{ targetLabel }}</span>
      </div>
      <p v-if="showExcerpt && comment.paragraphExcerpt" class="novel-cmt__excerpt">
        {{ comment.paragraphExcerpt }}
      </p>
      <p class="novel-cmt__content">
        {{ comment.content }}
      </p>
      <div class="novel-cmt__actions">
        <button
          type="button"
          class="novel-cmt__like"
          :class="{ 'novel-cmt__like--on': comment.isLiked }"
          :aria-label="comment.isLiked ? '取消赞' : '点赞'"
          @click="onLike"
        >
          <Icon :icon="comment.isLiked ? 'tabler:heart-filled' : 'tabler:heart'" width="14" height="14" aria-hidden="true" />
          <span>{{ comment.likeNum }}</span>
        </button>
        <button v-if="canDelete" type="button" class="novel-cmt__del" @click="onDelete">
          删除
        </button>
      </div>
    </div>
  </li>
</template>

<style scoped lang="scss">
.novel-cmt {
  display: flex;
  gap: 8px;
  padding: 10px 0;
  list-style: none;
  border-bottom: 1px solid var(--color-border, rgba(71, 85, 105, 0.12));

  &:last-child {
    border-bottom: none;
  }
}

.novel-cmt__body {
  flex: 1;
  min-width: 0;
}

.novel-cmt__head {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.novel-cmt__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text, #1e293b);
}

.novel-cmt__time {
  font-size: 11px;
  color: var(--color-text-muted, #94a3b8);
}

.novel-cmt__tag {
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  color: var(--accent, #2c3d56);
  background: var(--accent-soft, rgba(44, 61, 86, 0.08));
}

.novel-cmt__excerpt {
  margin: 4px 0 0;
  padding: 4px 8px;
  border-left: 2px solid var(--color-border-strong, rgba(71, 85, 105, 0.2));
  font-size: 11px;
  line-height: 1.5;
  color: var(--color-text-muted, #94a3b8);
}

.novel-cmt__content {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text, #1e293b);
  word-break: break-word;
  white-space: pre-wrap;
}

.novel-cmt__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 6px;
}

.novel-cmt__like,
.novel-cmt__del {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 4px;
  border: none;
  background: transparent;
  font-size: 12px;
  color: var(--color-text-muted, #94a3b8);
  cursor: pointer;

  &--on {
    color: #c2410c;
  }

  &:active {
    opacity: 0.6;
  }
}
</style>
