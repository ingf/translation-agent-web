'use client'

import { useState } from 'react'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { SettingsIcon } from '@/components/icons'

export default function Component() {
  const [inputText, setInputText] = useState('')
  const [translatedText, setTranslatedText] = useState('')
  const [initialTranslation, setInitialTranslation] = useState('')
  const [reflectTranslation, setReflectionTranslation] = useState('')
  const [improveTranslation, setImproveTranslation] = useState('')
  const [sourceLang, setSourceLang] = useState('English')
  const [targetLang, setTargetLang] = useState('Chinese')

  const handleInputChange = (e) => {
    setInputText(e.target.value)
  }
  // 客户端代码
  const handleInputBlur = async () => {
    if (inputText.trim() !== '') {
      try {
        setTranslatedText('')
        setInitialTranslation('')
        setReflectionTranslation('')
        setImproveTranslation('')

        const data = {
          source: sourceLang,
          target: targetLang,
          text: inputText,
        }
        const response = await fetch(
          `https://translation-agent-worker.ingf-ivan.workers.dev/api/translate?${new URLSearchParams(
            data,
          )}`,
        )

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()

          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            if (line.trim() !== '') {
              processChunk(line)
            }
          }
        }

        // 处理可能残留在 buffer 中的最后一行
        if (buffer.trim() !== '') {
          processChunk(buffer)
        }

        console.log('翻译过程完成')
      } catch (error) {
        console.error('翻译文本时出错:', error)
        console.log('翻译请求失败')
      }
    }
  }

  let stage = ''
  const processChunk = (data) => {
    console.log('data', data)

    if (data === null || data === ' \n' || data === '\n') return

    const dataFunctions = {
      initialTranslation: setInitialTranslation,
      reflectTranslation: setReflectionTranslation,
      improveTranslation: setImproveTranslation,
      complete: () => console.log('翻译过程完成'),
      error(msg) {
        console.error('翻译过程中出错:', msg)
        alert(msg)
      },
    }

    if (dataFunctions[data]) {
      if (data !== 'complete' && data !== 'error') {
        stage = data
        dataFunctions[data]('')
      } else {
        dataFunctions[data](data)
      }
    }

    const stageFunctions = {
      initialTranslation: setInitialTranslation,
      reflectTranslation: setReflectionTranslation,
      improveTranslation: setImproveTranslation,
    }

    setTimeout(() => {
      if (stageFunctions[stage] && stage !== data) {
        stageFunctions[stage]((prev) => prev + '\n' + data)
      }
    }, 1)
  }

  return (
    <div className="w-full h-screen flex flex-col">
      <header className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-2">
          <h1 className="text-xl font-bold">AI 翻译</h1>
        </div>
        {/* <div className="flex items-center space-x-4">
          <SettingsIcon className="h-6 w-6" />
        </div> */}
      </header>
      <main className="flex flex-col  p-4 ">
        <div className="flex ">
          <div className="flex items-center flex-1">
            {/* <Button variant="outline">检测语言</Button> */}
            <Select
              value={sourceLang}
              onValueChange={(value) => setSourceLang(value)}
            >
              <SelectTrigger className=" focus:ring-0  w-auto border-none">
                <SelectValue placeholder="选择语言" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="English">英语</SelectItem>
                <SelectItem value="Chinese">中文 (简体)</SelectItem>
                <SelectItem value="Japanese">日语</SelectItem>
                <SelectItem value="German">德语</SelectItem>
                <SelectItem value="French">法语</SelectItem>
                <SelectItem value="Spanish">西班牙语</SelectItem>
                <SelectItem value="Korean">韩语</SelectItem>
                <SelectItem value="Russian">俄语</SelectItem>
                <SelectItem value="Italian">意大利语</SelectItem>
                <SelectItem value="Portuguese">葡萄牙语</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center flex-1">
            <Select
              value={targetLang}
              onValueChange={(value) => setTargetLang(value)}
            >
              <SelectTrigger className=" focus:ring-0  w-auto border-none">
                <SelectValue placeholder="选择语言" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="English">英语</SelectItem>
                <SelectItem value="Chinese">中文 (简体)</SelectItem>
                <SelectItem value="Japanese">日语</SelectItem>
                <SelectItem value="German">德语</SelectItem>
                <SelectItem value="French">法语</SelectItem>
                <SelectItem value="Spanish">西班牙语</SelectItem>
                <SelectItem value="Korean">韩语</SelectItem>
                <SelectItem value="Russian">俄语</SelectItem>
                <SelectItem value="Italian">意大利语</SelectItem>
                <SelectItem value="Portuguese">葡萄牙语</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-col md:flex-row ">
          <textarea
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            className="flex-1 min-h-40 h-auto p-2  m-1 rounded focus:outline-none  border-none md:border md:border-solid"
            placeholder="输入文本"
          />

          <pre className="flex-1 min-h-40 h-auto p-2  m-1 rounded focus:outline-none  border-none bg-gray-100">
            {improveTranslation || '优化翻译'}
          </pre>
        </div>

        <div className="flex flex-col md:flex-row ">
          <pre className="flex-1 min-h-40 h-auto p-2  m-1 rounded focus:outline-none  border-none bg-gray-100 ">
            {initialTranslation || '初翻结果'}
          </pre>

          <pre className="flex-1 min-h-40 h-auto p-2  m-1 rounded focus:outline-none  border-none bg-gray-100 ">
            {reflectTranslation || '优化建议'}
          </pre>
        </div>
      </main>
    </div>
  )
}
