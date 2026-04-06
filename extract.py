import zipfile
import xml.etree.ElementTree as ET

def extract_text_from_docx(docx_path, output_path):
    word_namespace = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
    para = word_namespace + 'p'
    text = word_namespace + 't'
    
    document = zipfile.ZipFile(docx_path)
    xml_content = document.read('word/document.xml')
    document.close()
    
    tree = ET.XML(xml_content)
    
    paragraphs = []
    for paragraph in tree.iter(para):
        texts = [node.text for node in paragraph.iter(text) if node.text]
        if texts:
            paragraphs.append(''.join(texts))
            
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(paragraphs))

extract_text_from_docx('WYRM_GDD.docx', 'WYRM_GDD.txt')
