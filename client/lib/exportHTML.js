const JSZip = require('jszip');

window.ExportHtml = (Popup) => {
  const saveAs = function(blob, filename) {
    let dl = document.createElement('a');
    dl.href = window.URL.createObjectURL(blob);
    dl.onclick = event => document.body.removeChild(event.target);
    dl.style.display = 'none';
    dl.target = '_blank';
    dl.download = filename;
    document.body.appendChild(dl);
    dl.click();
  };

  const asyncForEach = async function (array, callback) {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array);
    }
  };

  const getPageHtmlString = (doc) => {
    return `<!doctype html>${doc.outerHTML}`;
  };

  const changeTagName = (element, newTagName) => {
    // Create a replacement tag of the desired type
    var replacement = document.createElement(newTagName);
    Array.from(element.attributes).forEach(attribute => {
      replacement.setAttribute(attribute.nodeName, attribute.nodeValue);
    });
    replacement.innerHTML = element.innerHTML;
    element.parentNode.replaceChild(replacement, element);
  }

  const ensureSidebarRemoved = (fragment) => {
    fragment.querySelector('.board-sidebar.sidebar').remove();
    return fragment;
  };

  const addJsonExportToZip = async (zip, boardSlug) => {
    const downloadJSONLink = document.querySelector('.download-json-link');
    const downloadJSONURL = downloadJSONLink.href;
    const response = await fetch(downloadJSONURL);
    const responseBody = await response.text();
    zip.file(`data/${boardSlug}.json`, responseBody);
  };

  const closeSidebar = () => {
    document.querySelector('.board-header-btn.js-toggle-sidebar').click();
  };

  const cleanBoardHtml = (boardSlug) => {
    let fragment = document.documentElement.cloneNode(true);

    fragment.querySelector('.h-feed').classList.remove('h-feed');
    fragment.querySelector('body').classList.add('h-feed');

    Array.from(fragment.querySelectorAll('script')).forEach(elem =>
      elem.remove(),
    );
    Array.from(
      fragment.querySelectorAll('link:not([rel="stylesheet"])'),
    ).forEach(elem => elem.remove());
    fragment.querySelector('#header-quick-access').remove();
    Array.from(
      fragment.querySelectorAll('#header-main-bar .board-header-btns'),
    ).forEach(elem => elem.remove());
    Array.from(fragment.querySelectorAll('.list-composer')).forEach(elem =>
      elem.remove(),
    );
    Array.from(
      fragment.querySelectorAll(
        '.list-composer,.js-card-composer, .js-add-card',
      ),
    ).forEach(elem => elem.remove());
    Array.from(
      fragment.querySelectorAll('.js-perfect-scrollbar > div:nth-of-type(n+2)'),
    ).forEach(elem => elem.remove());
    Array.from(fragment.querySelectorAll('.js-perfect-scrollbar')).forEach(
      elem => {
        elem.style = 'overflow-y: auto !important;';
        elem.classList.remove('js-perfect-scrollbar');
      },
    );
    Array.from(fragment.querySelectorAll('[href]:not(link)')).forEach(elem => {
      elem.attributes.removeNamedItem('href');
    });
    Array.from(fragment.querySelectorAll('[href]')).forEach(elem => {
      // eslint-disable-next-line no-self-assign
      elem.href = elem.href;
      // eslint-disable-next-line no-self-assign
      elem.src = elem.src;
    });
    Array.from(fragment.querySelectorAll('.is-editable')).forEach(elem => {
      elem.classList.remove('is-editable')
    })
    Array.from(fragment.querySelectorAll('a')).forEach(elem => {
      if (!Boolean(elem.classList.contains('u-url'))) {
        changeTagName(elem, 'span');
      }
    });

    fragment.querySelector('.u-url.p-name').remove();
    fragment.querySelector('h1').classList.add('p-name');
    fragment.querySelector('h1.p-name').innerHTML = `<a class="u-url">${
      fragment.querySelector('h1.p-name').innerText
    }</a>`;
    fragment.querySelector('h1.p-name > .u-url').href = `../${boardSlug}/`;

    Array.from(
      fragment.querySelectorAll('.minicard-title.p-name')
    ).forEach(elem => {
      elem.innerHTML = `${elem.innerText}`;
      changeTagName(elem, 'h3');
    });

    fragment.querySelector(
      '.is-sibling-sidebar-open'
    ).classList.remove('is-sibling-sidebar-open');

    return ensureSidebarRemoved(fragment);
  };

  const getBoardSlug = () => {
    return window.location.href.split('/').pop();
  };

  const cleanFileFromURLString = filename => {
    return decodeURIComponent(
      filename
        .split('/')
        .pop()
        .split('?')
        .shift()
        .split('#')
        .shift()
    );
  }

  const getStylesheetList = (doc) => {
    return Array.from(
      doc.querySelectorAll('link[href][rel="stylesheet"]'),
    );
  };

  const downloadStylesheets = async (stylesheets, zip) => {
    await asyncForEach(stylesheets, async elem => {
      const response = await fetch(elem.href);
      const responseBody = await response.text();

      const finalResponse = responseBody.replace(
        new RegExp('packages\/[^\/]+\/upstream\/', 'gim'), '../'
      );

      const filename = cleanFileFromURLString(elem.href);
      const fileFullPath = `style/${filename}`;
      zip.file(fileFullPath, finalResponse);
      elem.href = encodeURI(`../${fileFullPath}`);
    });
  };

  const getSrcAttached = (doc) => {
    return Array.from(doc.querySelectorAll('[src]'));
  };

  const downloadSrcAttached = async (elements, zip, boardSlug) => {
    await asyncForEach(elements, async elem => {
      const response = await fetch(elem.src);
      const responseBody = await response.blob();
      const filename = cleanFileFromURLString(elem.src);
      const fileFullPath = `${boardSlug}/${elem.tagName.toLowerCase()}/${filename}`;
      zip.file(fileFullPath, responseBody);
      elem.src = encodeURI(`./${elem.tagName.toLowerCase()}/${filename}`);
    });
  };

  const removeCssUrlSurround = url => {
    const working = url || "";
    return working
      .split("url(")
      .join("")
      .split("\")")
      .join("")
      .split("\"")
      .join("")
      .split("')")
      .join("")
      .split("'")
      .join("")
      .split(")")
      .join("");
  };

  const getCardCovers = (doc) => {
    return Array.from(doc.querySelectorAll('.minicard-cover'))
      .filter(elem => elem.style['background-image'])
  }

  const fixCardCovers = elements => {
    elements.forEach(elem => {
      const filename = cleanFileFromURLString(
        removeCssUrlSurround(elem.style['background-image'])
      );
      const imgURI = `./img/${filename}`;

      elem.style = `background-image: url("${encodeURI(imgURI)}")`;
    });
  };

  const addBoardHTMLToZip = (boardSlug, zip, doc) => {
    const htmlOutputPath = `${boardSlug}/index.html`;
    zip.file(htmlOutputPath, new Blob([
      getPageHtmlString(doc)
    ], { type: 'application/html' }));
  };

  return async () => {
    const zip = new JSZip();
    const boardSlug = getBoardSlug();

    await addJsonExportToZip(zip, boardSlug);
    Popup.close();
    closeSidebar();
    let doc = cleanBoardHtml(boardSlug);

    await downloadStylesheets(getStylesheetList(doc), zip);
    await downloadSrcAttached(getSrcAttached(doc), zip, boardSlug);
    fixCardCovers(getCardCovers(doc));

    addBoardHTMLToZip(boardSlug, zip, doc);

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `${boardSlug}.zip`);
  }
};
