export type QQImportSong = {
  songmid: string;
  songid: number;
  songType?: number;
};

/** Map read-API song type to playlist write type (QQMusicApi to_songlist_write_type). */
export function toSonglistWriteType(songType: number): number {
  if (songType === 0 || songType === 1) return 0;
  if (songType === 5 || songType === 111 || songType === 112 || songType === 113) {
    return songType;
  }
  return 1;
}

export function buildQQImportScript(options: {
  title: string;
  songs: QQImportSong[];
}): string {
  const payload = JSON.stringify({
    title: options.title,
    songs: options.songs
      .filter((song) => song.songmid || song.songid)
      .map((song) => ({
        songmid: song.songmid || "",
        songid: Number(song.songid || 0),
        songType: Number(song.songType ?? 0),
      })),
  });

  // Runs in the y.qq.com console with the user's login cookies.
  // Uses modern musicu AddPlaylist + AddSonglist (numeric songId), not the dead fcg_music_add2songdir.
  return `
(async()=>{
  const data=${payload};
  if(!location.hostname.includes('y.qq.com')){
    alert('请先打开并登录 https://y.qq.com ，再运行导入脚本');
    return;
  }

  const sleep=(ms)=>new Promise((r)=>setTimeout(r,ms));
  const getCookie=(name)=>{
    const m=document.cookie.match(new RegExp('(?:^|;\\\\s*)'+name+'=([^;]+)'));
    return m?decodeURIComponent(m[1]):'';
  };
  const hash33=(s,h=5381)=>{
    for(let i=0;i<s.length;i++){h=((h<<5)+h+s.charCodeAt(i))&0x7fffffff;}
    return h;
  };
  const writeType=(t)=>{
    t=Number(t||0);
    if(t===0||t===1) return 0;
    if(t===5||t===111||t===112||t===113) return t;
    return 1;
  };

  const uinRaw=getCookie('uin')||getCookie('wxuin')||getCookie('qqmusic_uin')||'0';
  const uin=String(uinRaw).replace(/^o/,'');
  const authst=getCookie('qm_keyst')||getCookie('qqmusic_key')||'';
  const skey=getCookie('p_skey')||getCookie('skey')||authst;
  const gtk=skey?hash33(skey):5381;

  if(!uin||uin==='0'){
    alert('未检测到登录态（uin 为空）。请先在 y.qq.com 登录后再粘贴运行。');
    return;
  }
  if(!authst){
    console.warn('[tune-bridge] 未找到 qm_keyst/qqmusic_key，写入可能失败');
  }

  async function musicu(moduleName, method, param){
    const body={
      comm:{
        ct:24,
        cv:0,
        format:'json',
        platform:'yqq.json',
        uin,
        uid:uin,
        guid:String(Date.now()),
        g_tk:gtk,
        g_tk_new_20200303:gtk,
        authst,
        qq:uin,
        notice:0,
        needNewCode:1
      },
      req_0:{module:moduleName,method,param}
    };
    const res=await fetch('https://u.y.qq.com/cgi-bin/musicu.fcg',{
      method:'POST',
      credentials:'include',
      headers:{
        'Content-Type':'application/json',
        Referer:'https://y.qq.com/'
      },
      body:JSON.stringify(body)
    });
    const json=await res.json();
    return json.req_0||json;
  }

  async function resolveSong(song){
    if(song.songid>0){
      return {songId:song.songid,songType:writeType(song.songType)};
    }
    if(!song.songmid) return null;
    const url='https://c.y.qq.com/v8/fcg-bin/fcg_play_single_song.fcg?songmid='+
      encodeURIComponent(song.songmid)+
      '&tpl=yqq_song_detail&format=json&platform=yqq&g_tk='+gtk;
    const res=await fetch(url,{credentials:'include',headers:{Referer:'https://y.qq.com'}});
    const json=await res.json();
    const info=(json.data&&json.data[0])||null;
    if(!info||!info.id) return null;
    return {songId:Number(info.id),songType:writeType(info.type)};
  }

  const playlistTitle=data.title||('导入歌单 '+new Date().toLocaleDateString());

  // 1) create playlist via modern API
  let dirId=0, tid=0;
  try{
    const created=await musicu(
      'music.musicasset.PlaylistBaseWrite',
      'AddPlaylist',
      {bFmtUtf8:true,dirName:playlistTitle}
    );
    console.log('[tune-bridge] AddPlaylist', created);
    const result=(created.data&&created.data.result)||created.data||{};
    dirId=Number(result.dirId||result.dirid||0);
    tid=Number(result.tid||0);
    const ret=Number((created.data&&created.data.retCode));
    if(Number(created.code)!==0 || (ret!==0 && !Number.isNaN(ret) && ret!==undefined) || !dirId){
      if(!dirId) throw new Error('code='+created.code+' ret='+ret);
    }
  }catch(err){
    // fallback: old create API (still works for many accounts)
    const createBody=new URLSearchParams({
      loginUin:uin,hostUin:'0',format:'json',inCharset:'utf8',outCharset:'utf8',
      notice:'0',platform:'yqq',needNewCode:'0',g_tk:String(gtk),uin,
      name:playlistTitle,
      show:'1',formsender:'1',utf8:'1',
      qzreferrer:'https://y.qq.com/portal/profile.html#sub=other&tab=create&'
    });
    const createRes=await fetch('https://c.y.qq.com/splcloud/fcgi-bin/create_playlist.fcg?g_tk='+gtk,{
      method:'POST',
      credentials:'include',
      headers:{'Content-Type':'application/x-www-form-urlencoded',Referer:'https://y.qq.com/n/yqq/playlist'},
      body:createBody
    });
    const created=await createRes.json();
    console.log('[tune-bridge] create_playlist fallback', created);
    dirId=Number(created.dirid||0);
    tid=Number(created.tid||0);
    if(Number(created.code)!==0 || !dirId){
      alert('创建歌单失败：'+(created.msg||created.code||(err&&err.message)||'请确认已登录'));
      return;
    }
  }

  // 2) resolve mids -> numeric ids
  console.log('[tune-bridge] resolving', data.songs.length, 'songs…');
  const resolved=[];
  const resolveFail=[];
  for(let i=0;i<data.songs.length;i++){
    const song=data.songs[i];
    try{
      const item=await resolveSong(song);
      if(item) resolved.push(item);
      else resolveFail.push(song.songmid||song.songid);
    }catch(_){
      resolveFail.push(song.songmid||song.songid);
    }
    if(i%40===39) await sleep(120);
    else await sleep(40);
  }
  console.log('[tune-bridge] resolved', resolved.length, 'fail', resolveFail.length, resolveFail.slice(0,5));
  if(!resolved.length){
    alert('没有解析到可导入的歌曲 ID。请回到转换页重新匹配后再复制脚本。');
    return;
  }

  // 3) add songs with modern AddSonglist (batch ≤20)
  let ok=0, fail=0;
  const errors=[];
  const BATCH=20;
  for(let i=0;i<resolved.length;i+=BATCH){
    const batch=resolved.slice(i,i+BATCH);
    try{
      const added=await musicu(
        'music.musicasset.PlaylistDetailWrite',
        'AddSonglist',
        {
          dirId,
          tid,
          dirName:playlistTitle,
          bFmtUtf8:true,
          v_songInfo:batch.map((s)=>({songId:s.songId,songType:s.songType}))
        }
      );
      console.log('[tune-bridge] AddSonglist batch', i/BATCH+1, added);
      const ret=Number(added.data&&added.data.retCode);
      const code=Number(added.code);
      if(code===0 && ret===0){
        ok+=batch.length;
      }else if(code===0 && (ret===0 || Number.isNaN(ret))){
        // some gateways omit retCode on success
        ok+=batch.length;
      }else{
        // retry one-by-one for this batch
        for(const s of batch){
          try{
            const one=await musicu(
              'music.musicasset.PlaylistDetailWrite',
              'AddSonglist',
              {
                dirId,
                tid,
                dirName:playlistTitle,
                bFmtUtf8:true,
                v_songInfo:[{songId:s.songId,songType:s.songType}]
              }
            );
            const oneRet=Number(one.data&&one.data.retCode);
            const oneCode=Number(one.code);
            if(oneCode===0 && (oneRet===0 || Number.isNaN(oneRet))){
              ok+=1;
            }else{
              fail+=1;
              if(errors.length<5){
                errors.push('id '+s.songId+': code='+oneCode+' ret='+oneRet);
              }
            }
          }catch(e){
            fail+=1;
            if(errors.length<5) errors.push('id '+s.songId+': '+(e&&e.message||e));
          }
          await sleep(120);
        }
        if(errors.length<5){
          errors.push('batch '+(i/BATCH+1)+': code='+code+' ret='+ret);
        }
      }
    }catch(e){
      fail+=batch.length;
      errors.push('batch '+(i/BATCH+1)+': '+(e&&e.message||e));
    }
    await sleep(280);
  }

  const summary=
    '导入完成\\n歌单：'+playlistTitle+
    '\\n目录 ID：'+dirId+' / tid：'+tid+
    '\\n解析到：'+resolved.length+' 首（源 '+data.songs.length+'）'+
    '\\n成功约：'+ok+' 首'+
    '\\n失败/跳过：'+fail+' 首'+
    (errors.length?('\\n错误示例：'+errors.slice(0,3).join(' | ')):'')+
    '\\n请到「我的歌单」刷新查看；控制台有 [tune-bridge] 日志';
  console.log('[tune-bridge]', summary.replace(/\\\\n/g,'\\n'));
  alert(summary);
  location.href='https://y.qq.com/n/ryqq/profile';
})();`.trim();
}

/** @deprecated Prefer buildQQImportScript with songid; kept for mid-only pastes. */
export function buildQQImportBookmarklet(options: {
  title: string;
  songmids: string[];
}): string {
  return buildQQImportScript({
    title: options.title,
    songs: options.songmids.map((songmid) => ({
      songmid,
      songid: 0,
      songType: 0,
    })),
  });
}
