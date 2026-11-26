<script setup lang="ts">
import type { Tag } from '@/api/info/getTeacher'

import {
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue'
import { getTeachers } from '@/api/info/getTeacher'
import PostList from '@/components/PostList.vue'
import { usePostListCache } from '@/composables/usePostListCache'
import { usePostView } from '@/composables/usePostView'
import { usePostStore } from '@/store/postStore'
import { setWindowScrollY } from '@/utils/windowScroll'

defineOptions({
  name: 'CourseView',
})

const tag = ref('')
const teachers = reactive<Tag[]>([])

const { changeTo, refreshPosts } = usePostStore()
const view = usePostView()
const { posts, isLoading, hasMore, initialize, update } = view

usePostListCache(view)

onMounted(async () => {
  setWindowScrollY(0)
  await initialize('课程专区')
  const resp = await getTeachers()
  teachers.splice(0, teachers.length, ...resp)
})
watch(tag, async (newTag) => {
  refreshPosts()
  changeTo('课程专区', newTag)
  hasMore.value = true
  await update()
})
</script>

<template>
  <div class="w-full">
    <h2>课程专区</h2>
    <div>
      <span class="gradientUnderline">请选择你的老师，不选也没关系 </span>
      <select
        id="teacher"
        v-model="tag"
      >
        <option
          v-for="teacher in teachers"
          :key="teacher.TagID"
          :value="teacher.Name"
        >
          {{ teacher.Name }}
        </option>
      </select>
    </div>
    <PostList :posts="posts" source="course" :is-loading="isLoading" :has-more="hasMore" @bottom="update" />
  </div>
</template>
