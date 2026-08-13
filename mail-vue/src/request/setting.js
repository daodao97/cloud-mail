import http from '@/axios/index.js';

export function settingSet(setting) {
    return http.put('/setting/set', setting)
}

export function settingQuery() {
    return http.get('/setting/query')
}

export function domainList() {
    return http.get('/public/domainList', { noMsg: true })
}

export function domainStatusList() {
    return http.get('/setting/domainStatus', { noMsg: true })
}

export function addDomain(params) {
    return http.post('/public/addDomain', params)
}

export function deleteDomain(domain) {
    return http.delete('/setting/domain', {params: {domain}})
}

export function websiteConfig() {
    return http.get('/setting/websiteConfig')
}

export function setBackground(background) {
    return http.put('/setting/setBackground',{background})
}

export function deleteBackground() {
    return http.delete('/setting/deleteBackground')
}

export function setBlackList(params) {
    return http.put('/setting/setBlacklist', params)
}
