const https = require('https');
const rl = require('readline').createInterface({input: process.stdin, output: process.stdout});
const ytdl = require('youtube-dl');
ytdl.setYtdlBinary('/usr/bin/youtube-dl');



let shows;
main ();
async function main () {

  if (!shows) {
    const censored = {
      host: "censored.tv",
      port: 443,
      path: "/shows",
      method: "GET"
    };
    const main_page = await fetch_page(censored);
    shows = [... new Set(JSON.parse(main_page))];
  }  
  const show_pick = await list_and_pick(shows.map(function(it) {return it.slug}));
  
  const show_episodes = await get_episodes(shows[show_pick].slug);  
  const ep_pick = await list_and_pick(show_episodes);
  await dl_ep(show_episodes[ep_pick]);

}

async function get_episodes(slug) {
  const base_path = "/watch/show/" + slug + "?page=";
  const show = {
    host: "censored.tv",
    port: 443,
    path: base_path + "1",
    method: "GET"
  }

  const page_one_html = await fetch_page(show);

  const n_pages = get_episodes_html_n_pages(page_one_html);
  const ep_pages = [];
  await function () {
    const pg_html_proms = [];
    for (let i = 1; i <= n_pages; i++) {
      show.path = base_path + i;
      const prom = fetch_page(show);
      prom.then(function(data){ 
        ep_pages.push(data);
      });
      pg_html_proms.push(prom);
    }
    return Promise.all(pg_html_proms);
  }();

  let episodes = [];

  for (let i = 0; i < ep_pages.length; i++) {
    episodes = episodes.concat(get_episodes_link_in_page(ep_pages[i]));
  } 
  return episodes;
}



function get_episodes_link_in_page(html) {

  const ep_link_reg = /<a href="(\/watch\/shows\/[^\"]*)"[^>]*>/ig;
  const ep_links = [];
  let reg_res;  
  while (reg_res = ep_link_reg.exec(html)) {
    reg_res.input = null;
    ep_links.push(reg_res[1]);
  }

  return [... new Set(ep_links)];
}

function get_episodes_html_n_pages (html) {

  const reg_page_link =/<(?:span|a) class=\"page-link\"(?: href=\"[^\"]*\")?>(\d*)<\/(?:span|a)>/ig;

  const html_slice = html.slice();
  let reg_res;
  let last_page = 1;
  while (reg_res = reg_page_link.exec(html_slice)) {
    reg_res.input = "";
    last_page = +reg_res[1] > last_page ? +reg_res[1] : last_page;
  }
  return last_page;
}

async function dl_ep (ep_path) {

  const master_url = await get_master_url(ep_path);
  const ep_name = ep_path.slice(ep_path.lastIndexOf('/') + 1);

  ytdl.exec(master_url, ['--hls-prefer-native', '-o', ep_name + '.mp4'], "", function(err, output){
    console.log(err);
    console.log(output);
  });
}

async function get_master_url (url_path) {

  const ep_page = {
    host: 'censored.tv',
    port: 443,
    path: url_path,
    method: 'GET',
    headers: {
      cookie: "YOUR LOGGED IN SESSION COOKIES"
    }
  }

  const ep_page_html = await fetch_page(ep_page);
  const source_reg = /<source src="([^"]*)" type="application\/x-mpegURL">/ig; 
  return source_reg.exec(ep_page_html)[1];
}

function list_and_pick (arr) {
  for (let i = 0; i < arr.length; i++) {
    console.log((i + "").padEnd(2) +": ", arr[i], "\n");
  }
  const pick_prom = new Promise(function (res, rej) {
  
    rl.question("pick 0 - " + (arr.length - 1) + "\n", function(pick) {
      if (+pick >= arr.length) res(list_and_pick(arr));
      else res(+pick);
    });
  }); 
  return pick_prom;
}

function fetch_page(page) {

  let data = "";
  const prom = new Promise(function(resolve, reject) {

    const req = https.request(page, function (res) {
  
      res.setEncoding('utf-8');
      res.on("error", reject);
      res.on("data", function(chunk) {
        data += chunk;
      });
      res.on("end", function(){
        resolve(data);
      });
    });
    req.end();
  });
  return prom;
}
